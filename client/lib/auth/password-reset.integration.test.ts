import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");

  return setCookie ? setCookie.split(";", 1)[0] : null;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object");

  return value as Record<string, unknown>;
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  assert.ok(match, "email text must contain a link");

  if (!match) {
    throw new Error("no url found in email text");
  }

  return match[0];
}

function extractToken(resetUrl: string): string {
  const url = new URL(resetUrl);
  const segments = url.pathname.split("/").filter(Boolean);

  return segments[segments.length - 1];
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "password reset integration test skipped: DATABASE_URL is not set"
    );
    return;
  }

  const [{ PrismaPg }, { PrismaClient }, { createAuth }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
    import("@/lib/auth/auth-core"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const sentEmails: SendEmailInput[] = [];
  const fakeMailer: Mailer = {
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      sentEmails.push(input);
      return { ok: true };
    },
  };
  const auth = createAuth(prisma, fakeMailer);
  const testEmails: string[] = [];
  const originalPassword = "a-long-test-password";

  async function createVerifiedUserWithSession(): Promise<{
    email: string;
    cookie: string;
  }> {
    const email = `password-reset-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Password reset test",
          email,
          password: originalPassword,
        }),
      })
    );

    const verificationSend = sentEmails.find(
      (send) => send.to === email && send.type === "verification"
    );
    assert.ok(verificationSend);

    const verifyResponse = await auth.handler(
      new Request(extractUrl(verificationSend!.template.text), {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    const cookie = sessionCookie(verifyResponse);
    assert.ok(cookie, "expected verification to sign the User in");

    return { email, cookie: cookie! };
  }

  function requestReset(email: string) {
    return auth.handler(
      new Request("http://localhost:3000/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      })
    );
  }

  async function testRequestReturnsGenericMessageForUnknownAndKnownEmail() {
    const { email } = await createVerifiedUserWithSession();
    const unknownEmail = `unknown-${randomUUID()}@example.test`;

    const knownResponse = await requestReset(email);
    const unknownResponse = await requestReset(unknownEmail);

    assert.equal(knownResponse.status, 200);
    assert.equal(unknownResponse.status, 200);

    const knownBody = record(await knownResponse.json());
    const unknownBody = record(await unknownResponse.json());
    assert.equal(
      knownBody.message,
      unknownBody.message,
      "requesting a reset for a known and unknown email must return the same message"
    );

    const unknownUser = await prisma.user.findUnique({
      where: { email: unknownEmail },
    });
    assert.equal(unknownUser, null);
  }

  async function testResetLinkIsSingleUseAndReissueInvalidatesPrior() {
    const { email } = await createVerifiedUserWithSession();

    async function requestAndExtractToken() {
      await requestReset(email);
      const sends = sentEmails.filter(
        (send) => send.to === email && send.type === "password-reset"
      );
      return extractToken(extractUrl(sends[sends.length - 1].template.text));
    }

    const firstToken = await requestAndExtractToken();
    const secondToken = await requestAndExtractToken();
    assert.notEqual(firstToken, secondToken);

    const staleResetResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          newPassword: "a-different-long-password",
          token: firstToken,
        }),
      })
    );
    assert.notEqual(
      staleResetResponse.status,
      200,
      "the invalidated prior reset token must not work"
    );

    const currentResetResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          newPassword: "a-brand-new-long-password",
          token: secondToken,
        }),
      })
    );
    assert.equal(currentResetResponse.status, 200);

    const reuseResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          newPassword: "yet-another-long-password",
          token: secondToken,
        }),
      })
    );
    assert.notEqual(
      reuseResponse.status,
      200,
      "a reset token must be single-use"
    );
  }

  async function testResetUpdatesPasswordAndRevokesAllSessions() {
    const { email, cookie } = await createVerifiedUserWithSession();

    const preResetSession = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    );
    assert.ok(record(await preResetSession.json()).user);

    await requestReset(email);
    const sends = sentEmails.filter(
      (send) => send.to === email && send.type === "password-reset"
    );
    const token = extractToken(
      extractUrl(sends[sends.length - 1].template.text)
    );
    const newPassword = "a-completely-new-long-password";

    const resetResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ newPassword, token }),
      })
    );
    assert.equal(resetResponse.status, 200);

    const postResetSession = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    );
    const postResetBody: unknown = await postResetSession.json();
    const postResetUser =
      postResetBody && typeof postResetBody === "object"
        ? (postResetBody as Record<string, unknown>).user
        : postResetBody;
    assert.equal(
      postResetUser,
      null,
      "a successful password reset must revoke the pre-existing session"
    );

    const signInWithNewPassword = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, password: newPassword }),
      })
    );
    assert.equal(signInWithNewPassword.status, 200);
    assert.ok(sessionCookie(signInWithNewPassword));
  }

  try {
    await testRequestReturnsGenericMessageForUnknownAndKnownEmail();
    await testResetLinkIsSingleUseAndReissueInvalidatesPrior();
    await testResetUpdatesPasswordAndRevokesAllSessions();
  } finally {
    await prisma.workspace.deleteMany({
      where: { owner: { email: { in: testEmails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: { in: testEmails } },
    });
    await prisma.$disconnect();
  }

  console.log("password reset integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
