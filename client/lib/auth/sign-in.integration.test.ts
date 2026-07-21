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

async function run() {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    throw new Error(
      "DATABASE_URL and REDIS_URL must be set to run sign-in integration tests."
    );
  }

  const [
    { PrismaPg },
    { PrismaClient },
    { createAuth },
    { createRedisProgressiveSignInRateLimiter },
  ] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
    import("@/lib/auth/auth-core"),
    import("@/lib/auth/progressive-sign-in-rate-limit"),
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
  const signInRateLimiter = createRedisProgressiveSignInRateLimiter(
    process.env.REDIS_URL
  );
  const auth = createAuth(prisma, fakeMailer, undefined, signInRateLimiter);
  const testEmails: string[] = [];
  const password = "a-long-test-password";

  async function createVerifiedUser(): Promise<string> {
    const email = `signin-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Sign-in test", email, password }),
      })
    );

    const verificationSend = sentEmails.find(
      (send) => send.to === email && send.type === "verification"
    );
    assert.ok(verificationSend, "expected a captured verification email");

    await auth.handler(
      new Request(extractUrl(verificationSend!.template.text), {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );

    return email;
  }

  async function testPasswordSignInSucceedsForVerifiedUser() {
    const email = await createVerifiedUser();
    const ipAddress = `198.17.${Number.parseInt(randomUUID().slice(0, 2), 16)}.${Number.parseInt(randomUUID().slice(0, 2), 16)}`;

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-for": ipAddress,
        },
        body: JSON.stringify({ email, password }),
      })
    );

    assert.equal(response.status, 200);
    assert.ok(
      sessionCookie(response),
      "correct credentials must create a session"
    );
  }

  async function testPasswordSignInFailsSafelyForWrongCredentials() {
    const email = await createVerifiedUser();
    const ipAddress = `198.18.${Number.parseInt(randomUUID().slice(0, 2), 16)}.${Number.parseInt(randomUUID().slice(0, 2), 16)}`;

    const wrongPasswordResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-for": ipAddress,
        },
        body: JSON.stringify({ email, password: "not-the-right-password" }),
      })
    );
    const unknownEmailResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-for": ipAddress,
        },
        body: JSON.stringify({
          email: `unknown-${randomUUID()}@example.test`,
          password: "whatever-password-12345",
        }),
      })
    );

    assert.notEqual(wrongPasswordResponse.status, 200);
    assert.notEqual(unknownEmailResponse.status, 200);
    assert.equal(sessionCookie(wrongPasswordResponse), null);
    assert.equal(sessionCookie(unknownEmailResponse), null);

    const wrongPasswordBody = record(await wrongPasswordResponse.json());
    const unknownEmailBody = record(await unknownEmailResponse.json());
    assert.equal(
      wrongPasswordBody.message,
      unknownEmailBody.message,
      "wrong password and unknown email must fail with the same generic message"
    );
    const event = await prisma.securityEvent.findFirst({
      where: { email, type: "failed-password-sign-in" },
    });
    assert.equal(
      event?.userId === null,
      false,
      "a failed password sign-in must create a durable security event"
    );
  }

  async function testRepeatedPasswordFailuresAreTemporarilyRestricted() {
    const email = await createVerifiedUser();
    const ipAddress = `198.19.${Number.parseInt(randomUUID().slice(0, 2), 16)}.${Number.parseInt(randomUUID().slice(0, 2), 16)}`;

    async function attempt(password: string): Promise<Response> {
      return auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": ipAddress,
          },
          body: JSON.stringify({ email, password }),
        })
      );
    }

    for (let failure = 0; failure < 5; failure += 1) {
      const response = await attempt("not-the-right-password");
      assert.notEqual(response.status, 200);
    }

    const restrictedResponse = await attempt(password);
    assert.equal(restrictedResponse.status, 429);
    assert.equal(
      record(await restrictedResponse.json()).message,
      "Please try again later.",
      "the retry window must not reveal account or security-control details"
    );
  }

  async function testMagicLinkRequestForUnknownEmailIsGenericAndCreatesNoUser() {
    const email = `magic-unknown-${randomUUID()}@example.test`;
    testEmails.push(email);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, callbackURL: "/my-tasks" }),
      })
    );
    const body = record(await response.json());

    assert.equal(response.status, 200);
    assert.equal(body.status, true);

    const user = await prisma.user.findUnique({ where: { email } });
    assert.equal(
      user,
      null,
      "requesting a magic link for an unknown email must not create a User"
    );

    const magicLinkSend = sentEmails.find(
      (send) => send.to === email && send.type === "magic-link"
    );
    assert.ok(
      magicLinkSend,
      "a magic link email is sent even for an unknown address (non-disclosure)"
    );
  }

  async function testMagicLinkConsumptionSignsInAutoVerifiesAndHonorsReturnUrl() {
    const email = `magic-verify-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Magic link test", email, password }),
      })
    );

    const returnUrl = "http://localhost:3000/lists/inbox";
    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, callbackURL: returnUrl }),
      })
    );

    const magicLinkSend = sentEmails.find(
      (send) => send.to === email && send.type === "magic-link"
    );
    assert.ok(magicLinkSend, "expected a captured magic link email");
    const magicLinkUrl = extractUrl(magicLinkSend!.template.text);

    const response = await auth.handler(
      new Request(magicLinkUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );

    const cookie = sessionCookie(response);
    assert.ok(cookie, "a valid magic link must sign the User in");
    assert.equal(
      response.headers.get("location"),
      returnUrl,
      "consuming the magic link must redirect to the requested return URL"
    );

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: cookie! },
      })
    );
    const sessionBody = record(await sessionResponse.json());
    assert.equal(record(sessionBody.user).emailVerified, true);
  }

  async function testMagicLinkIsSingleUseAndInvalidatesPriorLink() {
    const email = `magic-reissue-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Reissue test", email, password }),
      })
    );

    async function requestLink() {
      await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({ email, callbackURL: "/my-tasks" }),
        })
      );

      const sends = sentEmails.filter(
        (send) => send.to === email && send.type === "magic-link"
      );

      return extractUrl(sends[sends.length - 1].template.text);
    }

    const firstUrl = await requestLink();
    const secondUrl = await requestLink();
    assert.notEqual(firstUrl, secondUrl);

    const firstAttempt = await auth.handler(
      new Request(firstUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    assert.equal(
      sessionCookie(firstAttempt),
      null,
      "the invalidated prior link must not create a session"
    );

    const secondAttempt = await auth.handler(
      new Request(secondUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    assert.ok(
      sessionCookie(secondAttempt),
      "the current link must still sign the User in"
    );

    const secondAttemptReused = await auth.handler(
      new Request(secondUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    assert.equal(
      sessionCookie(secondAttemptReused),
      null,
      "a magic link must be single-use"
    );
  }

  try {
    await testPasswordSignInSucceedsForVerifiedUser();
    await testPasswordSignInFailsSafelyForWrongCredentials();
    await testRepeatedPasswordFailuresAreTemporarilyRestricted();
    await testMagicLinkRequestForUnknownEmailIsGenericAndCreatesNoUser();
    await testMagicLinkConsumptionSignsInAutoVerifiesAndHonorsReturnUrl();
    await testMagicLinkIsSingleUseAndInvalidatesPriorLink();
  } finally {
    await prisma.workspace.deleteMany({
      where: { owner: { email: { in: testEmails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: { in: testEmails } },
    });
    await prisma.$disconnect();
    await signInRateLimiter.close?.();
  }

  console.log("sign-in integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
