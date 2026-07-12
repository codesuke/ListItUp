import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";
import { resolveProtectedRouteRedirect } from "./protected-route";

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");

  return setCookie ? setCookie.split(";", 1)[0] : null;
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
      "protected route integration test skipped: DATABASE_URL is not set"
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

  async function testUnverifiedVisitorRedirectsAndReturnsToOriginalUrlAfterVerifying() {
    const email = `protected-route-${randomUUID()}@example.test`;
    testEmails.push(email);
    const protectedPath = "/lists/inbox";

    await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Protected route test",
          email,
          password: "a-long-test-password",
        }),
      })
    );

    // Simulate what a protected Server Component sees for this pending User:
    // no session yet, so it must redirect to sign-in with a return URL.
    const preSignUpRedirect = resolveProtectedRouteRedirect(
      null,
      protectedPath
    );
    assert.equal(
      preSignUpRedirect,
      `/sign-in?callbackURL=${encodeURIComponent(protectedPath)}`
    );

    // The User instead lands on /verify-email?returnTo=<protectedPath> (as our
    // sign-in/verify-email pages do) and the resend action threads returnTo
    // through as the magic link's callbackURL, exactly like resendVerificationAction.
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: protectedPath },
    });

    const latestVerificationSend = sentEmails
      .filter((send) => send.to === email && send.type === "verification")
      .at(-1);
    assert.ok(latestVerificationSend, "expected a captured verification email");

    const verifyUrl = extractUrl(latestVerificationSend!.template.text);
    const response = await auth.handler(
      new Request(verifyUrl, {
        headers: { origin: "http://localhost:3000" },
        redirect: "manual",
      })
    );

    assert.ok(
      sessionCookie(response),
      "completing verification must sign the User in"
    );
    assert.equal(
      response.headers.get("location"),
      protectedPath,
      "completing verification must return to the originally requested URL"
    );
  }

  try {
    await testUnverifiedVisitorRedirectsAndReturnsToOriginalUrlAfterVerifying();
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: { in: testEmails } },
    });
    await prisma.$disconnect();
  }

  console.log("protected route integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
