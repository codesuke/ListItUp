import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { createAuth } from "./auth-core";
import {
  createRedisEmailRequestRateLimiter,
  GENERIC_EMAIL_REQUEST_LIMIT_MESSAGE,
} from "./email-request-rate-limit";
import type { Mailer, SendEmailInput, SendEmailResult } from "@/lib/mailer/mailer-core";

function request(path: string, email: string, ipAddress: string): Request {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-for": ipAddress,
    },
    body: JSON.stringify(
      path === "/request-password-reset"
        ? { email, redirectTo: "/reset-password" }
        : { email, callbackURL: "/my-tasks" }
    ),
  });
}

async function assertSharedRecipientLimit(
  firstHandler: (request: Request) => Promise<Response>,
  secondHandler: (request: Request) => Promise<Response>,
  path: string,
  email: string
): Promise<void> {
  const firstResponse = await firstHandler(request(path, email, "198.51.100.10"));
  assert.equal(firstResponse.status, 200);

  const secondResponse = await secondHandler(
    request(path, email, "198.51.100.11")
  );
  assert.equal(secondResponse.status, 429);
  assert.equal(
    (await secondResponse.json() as { message: string }).message,
    GENERIC_EMAIL_REQUEST_LIMIT_MESSAGE
  );
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;

  if (!databaseUrl || !redisUrl) {
    throw new Error("DATABASE_URL and REDIS_URL must be set to run auth email-request limit tests.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const sentEmails: SendEmailInput[] = [];
  const mailer: Mailer = {
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      sentEmails.push(input);
      return { ok: true };
    },
  };
  const firstLimiter = createRedisEmailRequestRateLimiter(redisUrl);
  const secondLimiter = createRedisEmailRequestRateLimiter(redisUrl);
  const firstAuth = createAuth(prisma, mailer, firstLimiter);
  const secondAuth = createAuth(prisma, mailer, secondLimiter);
  const verificationEmail = `verification-${randomUUID()}@example.test`;
  const passwordResetEmail = `reset-${randomUUID()}@example.test`;

  try {
    await prisma.user.createMany({
      data: [
        { id: randomUUID(), name: "Verification User", email: verificationEmail },
        {
          id: randomUUID(),
          name: "Password Reset User",
          email: passwordResetEmail,
          emailVerified: true,
        },
      ],
    });

    await assertSharedRecipientLimit(
      firstAuth.handler,
      secondAuth.handler,
      "/send-verification-email",
      verificationEmail
    );
    await assertSharedRecipientLimit(
      firstAuth.handler,
      secondAuth.handler,
      "/request-password-reset",
      passwordResetEmail
    );
    await assertSharedRecipientLimit(
      firstAuth.handler,
      secondAuth.handler,
      "/sign-in/magic-link",
      `magic-${randomUUID()}@example.test`
    );

    const ipAddress = `203.0.113.${Number.parseInt(randomUUID().slice(0, 2), 16)}`;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await firstAuth.handler(
        request("/sign-in/magic-link", `ip-${attempt}-${randomUUID()}@example.test`, ipAddress)
      );
      assert.equal(response.status, 200);
    }
    const limitedResponse = await secondAuth.handler(
      request("/sign-in/magic-link", `ip-final-${randomUUID()}@example.test`, ipAddress)
    );
    assert.equal(limitedResponse.status, 429);
  } finally {
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: { in: [verificationEmail, passwordResetEmail] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [verificationEmail, passwordResetEmail] } },
    });
    await prisma.$disconnect();
    await Promise.all([firstLimiter.close?.(), secondLimiter.close?.()]);
  }

  console.log("auth email-request endpoint limits integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
