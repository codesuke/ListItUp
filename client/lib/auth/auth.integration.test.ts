import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";

const THIRTY_DAYS_IN_SECONDS = 2_592_000;
const SESSION_UPDATE_AGE_SECONDS = 86_400;
const ONE_SECOND_IN_MILLISECONDS = 1_000;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");

  return setCookie ? setCookie.split(";", 1)[0] : null;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object");

  return value as Record<string, unknown>;
}

function sessionExpiry(responseBody: unknown): Date {
  const session = record(record(responseBody).session);
  const expiresAt = session.expiresAt;
  assert.equal(typeof expiresAt, "string");

  if (typeof expiresAt !== "string") {
    throw new Error(
      "Better Auth returned a session without an expiration time."
    );
  }

  return new Date(expiresAt);
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  assert.ok(match, "verification email text must contain a link");

  if (!match) {
    throw new Error("no url found in email text");
  }

  return match[0];
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "auth database integration test skipped: DATABASE_URL is not set"
    );
    return;
  }

  const [{ PrismaPg }, { PrismaClient }, { createAuth }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
    import("./auth-core"),
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

  function signUp(email: string, password = "a-long-test-password") {
    return auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Auth integration test",
          email,
          password,
          callbackURL: "/my-tasks",
        }),
      })
    );
  }

  async function testSignUpCreatesPendingUserAndSendsVerificationEmail() {
    const email = `signup-${randomUUID()}@example.test`;
    testEmails.push(email);

    const response = await signUp(email);
    assert.equal(response.status, 200);
    assert.equal(
      sessionCookie(response),
      null,
      "an unverified sign-up must not create a session"
    );

    const user = await prisma.user.findUnique({ where: { email } });
    assert.ok(user, "sign-up must create a pending User row");
    assert.equal(user?.emailVerified, false);

    const verificationSends = sentEmails.filter(
      (send) => send.to === email && send.type === "verification"
    );
    assert.equal(
      verificationSends.length,
      1,
      "sign-up must send exactly one verification email"
    );

    const workspace = await prisma.workspace.findUnique({
      where: { ownerId: user!.id },
    });
    assert.equal(
      workspace,
      null,
      "an unverified User must not have a personal Workspace yet"
    );
  }

  async function testInvalidVerificationLinkFailsSafely() {
    const response = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/verify-email?token=not-a-real-token&callbackURL=%2Fmy-tasks",
        { headers: { origin: "http://localhost:3000" } }
      )
    );

    assert.notEqual(
      response.status,
      200,
      "an invalid verification token must not report success"
    );
    assert.equal(
      sessionCookie(response),
      null,
      "an invalid verification token must not create a session"
    );
  }

  async function testValidVerificationSignsInAndProvisionsWorkspace() {
    const email = `verify-${randomUUID()}@example.test`;
    testEmails.push(email);

    await signUp(email);
    const verificationSend = sentEmails.find(
      (send) => send.to === email && send.type === "verification"
    );
    assert.ok(verificationSend, "expected a captured verification email");

    const verifyUrl = extractUrl(verificationSend!.template.text);
    const response = await auth.handler(
      new Request(verifyUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );

    const cookie = sessionCookie(response);
    assert.ok(
      cookie,
      "a valid verification link must sign the User in automatically"
    );

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: cookie! },
      })
    );
    const sessionBody = record(await sessionResponse.json());
    const sessionUser = record(sessionBody.user);
    assert.equal(sessionUser.emailVerified, true);
    assert.equal(sessionUser.email, email);

    const userId = sessionUser.id as string;
    const workspace = await prisma.workspace.findUnique({
      where: { ownerId: userId },
      include: { lists: true },
    });
    assert.ok(workspace, "verified first sign-in must provision a Workspace");
    assert.equal(workspace!.lists.length, 1);
    assert.equal(workspace!.lists[0].isInbox, true);

    return { userId, cookie: cookie! };
  }

  async function testDuplicateSignUpAgainstVerifiedEmailDoesNotLeak(
    email: string
  ) {
    const beforeCount = await prisma.user.count({ where: { email } });
    const response = await signUp(email, "a-different-test-password");
    const body = record(await response.json());

    assert.equal(response.status, 200);
    assert.equal(
      body.token,
      null,
      "a duplicate sign-up against a verified email must not disclose existence"
    );

    const afterCount = await prisma.user.count({ where: { email } });
    assert.equal(
      afterCount,
      beforeCount,
      "a duplicate sign-up must not create a second User row"
    );
  }

  async function testDuplicateSignUpAgainstUnverifiedEmailResends() {
    const email = `resend-${randomUUID()}@example.test`;
    testEmails.push(email);

    await signUp(email);
    const firstSendCount = sentEmails.filter(
      (send) => send.to === email
    ).length;
    assert.equal(firstSendCount, 1);

    const throttle = await prisma.verificationEmailThrottle.findUnique({
      where: { identifier: email },
    });
    assert.ok(
      throttle,
      "sending a verification email must record a resend-cooldown timestamp"
    );

    await prisma.verificationEmailThrottle.updateMany({
      where: { identifier: email },
      data: {
        lastSentAt: new Date(
          Date.now() - (VERIFICATION_RESEND_COOLDOWN_SECONDS + 5) * 1000
        ),
      },
    });

    await signUp(email, "yet-another-test-password");
    const secondSendCount = sentEmails.filter(
      (send) => send.to === email
    ).length;
    assert.equal(
      secondSendCount,
      2,
      "a duplicate sign-up against an unverified email past cooldown must resend"
    );

    const userCount = await prisma.user.count({ where: { email } });
    assert.equal(userCount, 1, "resend must not create a second pending User");
  }

  async function testRollingSessionRenewal(userId: string, cookie: string) {
    const initialSessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    );
    const initialExpiry = sessionExpiry(await initialSessionResponse.json());

    await prisma.session.updateMany({
      where: { userId },
      data: {
        expiresAt: new Date(
          Date.now() +
            (THIRTY_DAYS_IN_SECONDS - SESSION_UPDATE_AGE_SECONDS - 1) *
              ONE_SECOND_IN_MILLISECONDS
        ),
      },
    });

    const renewedSessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    );
    const renewedExpiry = sessionExpiry(await renewedSessionResponse.json());

    assert.ok(renewedExpiry > initialExpiry);
  }

  try {
    await testSignUpCreatesPendingUserAndSendsVerificationEmail();
    await testInvalidVerificationLinkFailsSafely();
    const { userId, cookie } =
      await testValidVerificationSignsInAndProvisionsWorkspace();
    await testDuplicateSignUpAgainstVerifiedEmailDoesNotLeak(
      testEmails.find((email) => email.startsWith("verify-"))!
    );
    await testDuplicateSignUpAgainstUnverifiedEmailResends();
    await testRollingSessionRenewal(userId, cookie);
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

  console.log("auth sign-up and verification integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
