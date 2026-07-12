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

async function hasValidSession(
  auth: { handler: (request: Request) => Promise<Response> },
  cookie: string
): Promise<boolean> {
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/get-session", {
      headers: { cookie },
    })
  );
  const body: unknown = await response.json();

  return Boolean(
    body && typeof body === "object" && (body as Record<string, unknown>).user
  );
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "security settings integration test skipped: DATABASE_URL is not set"
    );
    return;
  }

  const [
    { PrismaPg },
    { PrismaClient },
    { createAuth },
    { recordPendingEmailChange },
  ] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
    import("@/lib/auth/auth-core"),
    import("./pending-email-change"),
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
  const password = "a-long-test-password";

  async function createVerifiedUserSession(): Promise<{
    email: string;
    cookie: string;
  }> {
    const email = `security-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Security settings test",
          email,
          password,
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
    assert.ok(cookie);

    return { email, cookie: cookie! };
  }

  async function signInSession(email: string, currentPassword: string) {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, password: currentPassword }),
      })
    );
    const cookie = sessionCookie(response);
    assert.ok(cookie, "expected sign-in to succeed");

    return cookie!;
  }

  async function testPasswordChangeRevokesOtherSessions() {
    const { email, cookie: firstDeviceCookie } =
      await createVerifiedUserSession();
    const secondDeviceCookie = await signInSession(email, password);
    const newPassword = "a-new-long-password-value";

    const changeResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: firstDeviceCookie,
        },
        body: JSON.stringify({
          currentPassword: password,
          newPassword,
          revokeOtherSessions: true,
        }),
      })
    );
    assert.equal(changeResponse.status, 200);
    const newCookie = sessionCookie(changeResponse);
    assert.ok(
      newCookie,
      "changing the password must reissue the current device's session"
    );

    assert.equal(
      await hasValidSession(auth, secondDeviceCookie),
      false,
      "changing the password must revoke other sessions"
    );
    assert.equal(
      await hasValidSession(auth, newCookie!),
      true,
      "the current device must remain signed in after a password change"
    );

    const oldPasswordSignIn = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, password }),
      })
    );
    assert.notEqual(oldPasswordSignIn.status, 200);
  }

  async function testSessionListingAndSignOutOtherSessions() {
    const { email, cookie: firstCookie } = await createVerifiedUserSession();
    const secondCookie = await signInSession(email, password);

    const listResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/list-sessions", {
        headers: { cookie: firstCookie },
      })
    );
    assert.equal(listResponse.status, 200);
    const sessions = (await listResponse.json()) as Array<{ token: string }>;
    assert.equal(sessions.length, 2);

    const firstSessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: firstCookie },
      })
    );
    const firstToken = record(record(await firstSessionResponse.json()).session)
      .token as string;
    const otherSession = sessions.find((entry) => entry.token !== firstToken);
    assert.ok(otherSession);

    const revokeResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/revoke-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: firstCookie,
        },
        body: JSON.stringify({ token: otherSession!.token }),
      })
    );
    assert.equal(revokeResponse.status, 200);

    assert.equal(await hasValidSession(auth, secondCookie), false);
    assert.equal(await hasValidSession(auth, firstCookie), true);
  }

  async function testEmailChangeFullFlow() {
    const { email: oldEmail, cookie } = await createVerifiedUserSession();
    const newEmail = `security-new-${randomUUID()}@example.test`;
    testEmails.push(newEmail);

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    );
    const userId = record(record(await sessionResponse.json()).user)
      .id as string;

    await recordPendingEmailChange(prisma, userId, oldEmail, newEmail, 24);

    const changeEmailResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/change-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
        body: JSON.stringify({
          newEmail,
          callbackURL: "/settings/security",
        }),
      })
    );
    assert.equal(changeEmailResponse.status, 200);

    const changeSend = sentEmails.find(
      (send) => send.to === newEmail && send.type === "email-change"
    );
    assert.ok(
      changeSend,
      "requesting an email change must send a verification link to the new address"
    );

    const confirmResponse = await auth.handler(
      new Request(extractUrl(changeSend!.template.text), {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    assert.ok(
      sessionCookie(confirmResponse) || confirmResponse.status !== 200,
      "confirming the new email should not silently fail"
    );

    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(updatedUser?.email, newEmail);
    assert.equal(updatedUser?.emailVerified, true);

    const noticeSend = sentEmails.find(
      (send) => send.to === oldEmail && send.type === "email-changed-notice"
    );
    assert.ok(
      noticeSend,
      "completing an email change must notify the old address"
    );

    assert.equal(
      await hasValidSession(auth, cookie),
      false,
      "completing an email change must revoke all sessions"
    );

    const signInWithNewEmail = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: newEmail, password }),
      })
    );
    assert.equal(signInWithNewEmail.status, 200);
  }

  try {
    await testPasswordChangeRevokesOtherSessions();
    await testSessionListingAndSignOutOtherSessions();
    await testEmailChangeFullFlow();
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

  console.log("security settings integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
