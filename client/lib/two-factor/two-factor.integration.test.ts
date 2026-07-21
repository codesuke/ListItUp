import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";

import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");

  return setCookie ? setCookie.split(";", 1)[0] : null;
}

function twoFactorCookie(response: Response): string | null {
  const cookies = response.headers.getSetCookie();
  const cookie = cookies.find((value) => value.includes("two_factor="));

  return cookie ? cookie.split(";", 1)[0] : null;
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
  if (!process.env.DATABASE_URL) {
    console.log("two-factor integration test skipped: DATABASE_URL is not set");
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
  const password = "a-long-test-password";

  async function createVerifiedUserSession(): Promise<{
    email: string;
    cookie: string;
  }> {
    const email = `two-factor-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Two-factor test", email, password }),
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

  async function enrollTwoFactor(cookie: string): Promise<string[]> {
    const enableResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/two-factor/enable", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
        body: JSON.stringify({ password }),
      })
    );
    assert.equal(enableResponse.status, 200);
    const { totpURI, backupCodes } = record(await enableResponse.json()) as {
      totpURI: string;
      backupCodes: string[];
    };

    const secret = new URL(totpURI).searchParams.get("secret");
    assert.ok(secret, "expected a totp secret in the enrollment URI");

    const decodedSecret = new TextDecoder().decode(base32.decode(secret!));
    const code = await createOTP(decodedSecret, {
      digits: 6,
      period: 30,
    }).totp();
    const confirmResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
        body: JSON.stringify({ code }),
      })
    );
    assert.equal(
      confirmResponse.status,
      200,
      "a valid TOTP code must confirm enrollment"
    );

    return backupCodes;
  }

  async function testEnrollmentRequiresValidTotpBeforeEnabling() {
    const { email, cookie } = await createVerifiedUserSession();

    const beforeEnroll = await prisma.user.findUnique({ where: { email } });
    assert.equal(beforeEnroll?.twoFactorEnabled, false);

    await enrollTwoFactor(cookie);

    const afterEnroll = await prisma.user.findUnique({ where: { email } });
    assert.equal(
      afterEnroll?.twoFactorEnabled,
      true,
      "enrollment must not complete until a valid TOTP code is confirmed"
    );
  }

  async function testPasswordSignInChallengeWithTotpAndBackupCode() {
    const { email, cookie } = await createVerifiedUserSession();
    const backupCodes = await enrollTwoFactor(cookie);

    async function attemptSignIn() {
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({ email, password }),
        })
      );
      const body = record(await response.json());
      const pendingCookie = twoFactorCookie(response);

      return { body, pendingCookie };
    }

    const firstAttempt = await attemptSignIn();
    assert.equal(firstAttempt.body.twoFactorRedirect, true);
    assert.ok(
      firstAttempt.pendingCookie,
      "a 2FA-enabled sign-in must set a pending-challenge cookie, not a session"
    );

    const twoFactorRow = await prisma.twoFactor.findFirst({
      where: { user: { email } },
    });
    assert.ok(twoFactorRow);

    const decryptSecret = (await import("better-auth/crypto")).symmetricDecrypt;
    const rawSecret = await decryptSecret({
      key: process.env.BETTER_AUTH_SECRET!,
      data: twoFactorRow!.secret,
    });
    const totpCode = await createOTP(rawSecret, {
      digits: 6,
      period: 30,
    }).totp();

    const totpChallengeResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: firstAttempt.pendingCookie!,
        },
        body: JSON.stringify({ code: totpCode }),
      })
    );
    assert.equal(totpChallengeResponse.status, 200);
    assert.ok(
      sessionCookie(totpChallengeResponse),
      "a valid TOTP challenge response must grant a session"
    );

    const secondAttempt = await attemptSignIn();
    assert.equal(secondAttempt.body.twoFactorRedirect, true);

    const backupCode = backupCodes[0];
    const backupChallengeResponse = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/two-factor/verify-backup-code",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            cookie: secondAttempt.pendingCookie!,
          },
          body: JSON.stringify({ code: backupCode }),
        }
      )
    );
    assert.equal(backupChallengeResponse.status, 200);
    assert.ok(sessionCookie(backupChallengeResponse));

    const thirdAttempt = await attemptSignIn();
    const reuseResponse = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/two-factor/verify-backup-code",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            cookie: thirdAttempt.pendingCookie!,
          },
          body: JSON.stringify({ code: backupCode }),
        }
      )
    );
    assert.notEqual(
      reuseResponse.status,
      200,
      "a consumed recovery code must be rejected on a second attempt"
    );
  }

  async function testPasswordResetStillRequiresTwoFactorChallenge() {
    const { email, cookie } = await createVerifiedUserSession();
    await enrollTwoFactor(cookie);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      })
    );
    const resetSend = sentEmails.find(
      (send) => send.to === email && send.type === "password-reset"
    );
    assert.ok(resetSend);
    const resetToken = new URL(extractUrl(resetSend!.template.text)).pathname
      .split("/")
      .filter(Boolean)
      .at(-1);
    const newPassword = "a-brand-new-long-password";

    const resetResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ newPassword, token: resetToken }),
      })
    );
    assert.equal(resetResponse.status, 200);
    assert.equal(
      sessionCookie(resetResponse),
      null,
      "a password reset must never grant a session by itself"
    );

    const signInResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, password: newPassword }),
      })
    );
    const signInBody = record(await signInResponse.json());
    assert.equal(
      signInBody.twoFactorRedirect,
      true,
      "signing in with the new password must still require the 2FA challenge"
    );
    assert.equal(sessionCookie(signInResponse) === null, false);
  }

  async function testMagicLinkSignInBypasses2FA() {
    // Deliberate product decision (see docs/ADR/0003, superseded): a magic
    // link already proves inbox possession, which is treated as sufficient
    // on its own. 2FA protects password sign-in specifically, not every
    // sign-in method.
    const { email, cookie } = await createVerifiedUserSession();
    await enrollTwoFactor(cookie);

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
    const magicLinkSend = sentEmails.find(
      (send) => send.to === email && send.type === "magic-link"
    );
    assert.ok(magicLinkSend);
    const magicLinkUrl = extractUrl(magicLinkSend!.template.text);

    const verifyResponse = await auth.handler(
      new Request(magicLinkUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );
    const magicLinkCookie = sessionCookie(verifyResponse);
    assert.ok(
      magicLinkCookie,
      "a magic link must sign a 2FA-enabled User in directly, with no challenge"
    );
    const callbackLocation = verifyResponse.headers.get("location");
    assert.ok(callbackLocation);
    assert.equal(
      new URL(callbackLocation).pathname,
      "/my-tasks",
      "it must redirect straight to the requested callback URL, not a challenge screen"
    );

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: magicLinkCookie! },
      })
    );
    const sessionUser = record(record(await sessionResponse.json()).user);
    assert.equal(sessionUser.twoFactorEnabled, true);
  }

  try {
    await testEnrollmentRequiresValidTotpBeforeEnabling();
    await testPasswordSignInChallengeWithTotpAndBackupCode();
    await testPasswordResetStillRequiresTwoFactorChallenge();
    await testMagicLinkSignInBypasses2FA();
  } finally {
    await prisma.twoFactor.deleteMany({
      where: { user: { email: { in: testEmails } } },
    });
    await prisma.workspace.deleteMany({
      where: { owner: { email: { in: testEmails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: { in: testEmails } },
    });
    await prisma.$disconnect();
  }

  console.log("two-factor integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
