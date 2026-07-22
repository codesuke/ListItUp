import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { createAuth } from "./auth-core";
import { requestPasswordResetEmail } from "./password-reset-request";
import type { Mailer, SendEmailResult } from "@/lib/mailer/mailer-core";

function request(path: string, body: Record<string, string>): Request {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

async function assertRequiredEmailFailsWhenDeliveryFails(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: Record<string, string>
): Promise<void> {
  const response = await handler(request(path, body));

  assert.notEqual(
    response.status,
    200,
    `${path} must fail when its required email cannot be delivered`
  );
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL must be set to run auth email delivery-failure tests."
    );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const email = `delivery-failure-${randomUUID()}@example.test`;
  const successfulMailer: Mailer = {
    async send(): Promise<SendEmailResult> {
      return { ok: true };
    },
  };
  const failedMailer: Mailer = {
    async send(): Promise<SendEmailResult> {
      return { ok: false, reason: "send-failed" };
    },
  };
  const setupAuth = createAuth(prisma, successfulMailer);
  const failedDeliveryAuth = createAuth(prisma, failedMailer);

  try {
    await setupAuth.handler(
      request("/sign-up/email", {
        name: "Delivery failure",
        email,
        password: "a-long-test-password",
      })
    );

    await assertRequiredEmailFailsWhenDeliveryFails(
      failedDeliveryAuth.handler,
      "/send-verification-email",
      { email, callbackURL: "/my-tasks" }
    );

    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    for (const [path, body] of [
      ["/sign-in/magic-link", { email, callbackURL: "/my-tasks" }],
    ] as const) {
      await assertRequiredEmailFailsWhenDeliveryFails(
        failedDeliveryAuth.handler,
        path,
        body
      );
    }

    assert.equal(
      await requestPasswordResetEmail(prisma, failedMailer, email),
      "failed",
      "password reset must report delivery failure so the User can retry"
    );
  } finally {
    await prisma.workspace.deleteMany({ where: { owner: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: email },
    });
    await prisma.$disconnect();
  }

  console.log("auth email delivery-failure integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
