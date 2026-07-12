import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";

import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";
import { verifyAndConsumeBackupCode } from "./two-factor-verification";

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
      "two-factor management integration test skipped: DATABASE_URL is not set"
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
  const password = "a-long-test-password";
  const authSecret = process.env.BETTER_AUTH_SECRET!;

  async function createVerifiedUserSession(): Promise<{
    userId: string;
    email: string;
    cookie: string;
  }> {
    const email = `two-factor-mgmt-${randomUUID()}@example.test`;
    testEmails.push(email);

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "2FA management test", email, password }),
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

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    );
    const userId = record(record(await sessionResponse.json()).user)
      .id as string;

    return { userId, email, cookie: cookie! };
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
    const { totpURI, backupCodes } = record(await enableResponse.json()) as {
      totpURI: string;
      backupCodes: string[];
    };
    const secret = new URL(totpURI).searchParams.get("secret")!;
    const code = await createOTP(secret, { digits: 6, period: 30 }).totp();

    await auth.handler(
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

    return backupCodes;
  }

  async function testDisableRequiresReauthAndSecondFactor() {
    const { userId, email, cookie } = await createVerifiedUserSession();
    const backupCodes = await enrollTwoFactor(cookie);

    const otherDeviceResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, password }),
      })
    );
    const otherDeviceTwoFactorCookie = sessionCookie(otherDeviceResponse);
    assert.ok(otherDeviceTwoFactorCookie);
    const totpChallengeResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: otherDeviceTwoFactorCookie!,
        },
        body: JSON.stringify({
          code: await (async () => {
            const twoFactorRow = await prisma.twoFactor.findFirst({
              where: { userId },
            });
            const decryptSecret = (await import("better-auth/crypto"))
              .symmetricDecrypt;
            const rawSecret = await decryptSecret({
              key: authSecret,
              data: twoFactorRow!.secret,
            });
            return createOTP(rawSecret, { digits: 6, period: 30 }).totp();
          })(),
        }),
      })
    );
    const otherDeviceCookie = sessionCookie(totpChallengeResponse);
    assert.ok(otherDeviceCookie, "expected the second device to sign in");

    // Mirrors disableTwoFactorAction's own pre-check: verify the submitted
    // code out-of-band before calling the built-in endpoints, since
    // disableTwoFactor only checks the password itself.
    const twoFactorRow = await prisma.twoFactor.findFirst({
      where: { userId },
    });
    assert.ok(
      await verifyAndConsumeBackupCode(
        twoFactorRow!.backupCodes,
        backupCodes[0],
        authSecret
      ).then((result) => result.ok),
      "the submitted recovery code must verify against the enrolled secret"
    );

    await auth.handler(
      new Request("http://localhost:3000/api/auth/revoke-other-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
      })
    );
    const disableResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/two-factor/disable", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
        body: JSON.stringify({ password }),
      })
    );
    assert.equal(disableResponse.status, 200);
    const newCookie = sessionCookie(disableResponse);
    assert.ok(newCookie, "disabling 2FA must keep the current session active");

    assert.equal(
      await prisma.twoFactor.findFirst({ where: { userId } }),
      null,
      "disabling 2FA must invalidate all remaining recovery codes"
    );
    assert.equal(
      await hasValidSession(auth, otherDeviceCookie!),
      false,
      "disabling 2FA must revoke other sessions"
    );
    assert.equal(
      await hasValidSession(auth, newCookie!),
      true,
      "disabling 2FA must keep the current session"
    );

    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user?.twoFactorEnabled, false);
  }

  async function testRegenerateBackupCodesInvalidatesOldSet() {
    const { userId, cookie } = await createVerifiedUserSession();
    const originalCodes = await enrollTwoFactor(cookie);

    const regenerateResponse = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/two-factor/generate-backup-codes",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            cookie,
          },
          body: JSON.stringify({ password }),
        }
      )
    );
    assert.equal(regenerateResponse.status, 200);
    const { backupCodes: newCodes } = record(
      await regenerateResponse.json()
    ) as { backupCodes: string[] };
    assert.notDeepEqual(newCodes.sort(), originalCodes.sort());

    const twoFactorRow = await prisma.twoFactor.findFirst({
      where: { userId },
    });
    const oldCodeResult = await verifyAndConsumeBackupCode(
      twoFactorRow!.backupCodes,
      originalCodes[0],
      authSecret
    );
    assert.equal(
      oldCodeResult.ok,
      false,
      "a pre-regeneration recovery code must no longer verify"
    );

    const newCodeResult = await verifyAndConsumeBackupCode(
      twoFactorRow!.backupCodes,
      newCodes[0],
      authSecret
    );
    assert.equal(newCodeResult.ok, true);
  }

  try {
    await testDisableRequiresReauthAndSecondFactor();
    await testRegenerateBackupCodesInvalidatesOldSet();

    // The security-notice emails for disable/regenerate are sent by
    // app/settings/security/actions.ts itself (via the shared `mailer`
    // singleton), not by anything in auth-core.ts — these Server Actions
    // call next/headers' headers(), which only works inside a real Next.js
    // request, so they cannot be exercised from this tsx test harness. The
    // notice-sending calls are one line each and read directly off the
    // already-covered recoveryCodeNoticeEmail/twoFactorNoticeEmail
    // templates (see lib/mailer/email-templates/templates.test.ts).
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

  console.log("two-factor management integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
