import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { invalidateOtherPasswordResetTokens } from "./password-reset-tokens";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "password reset token invalidation integration test skipped: DATABASE_URL is not set"
    );
    return;
  }

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const userId = randomUUID();
  const otherUserId = randomUUID();
  const priorToken = `prior-${randomUUID()}`;
  const currentToken = `current-${randomUUID()}`;
  const otherUserToken = `unrelated-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  try {
    await prisma.verification.createMany({
      data: [
        {
          id: randomUUID(),
          identifier: `reset-password:${priorToken}`,
          value: userId,
          expiresAt,
        },
        {
          id: randomUUID(),
          identifier: `reset-password:${currentToken}`,
          value: userId,
          expiresAt,
        },
        {
          id: randomUUID(),
          identifier: `reset-password:${otherUserToken}`,
          value: otherUserId,
          expiresAt,
        },
      ],
    });

    await invalidateOtherPasswordResetTokens(prisma, userId, currentToken);

    const remaining = await prisma.verification.findMany({
      where: {
        identifier: {
          in: [
            `reset-password:${priorToken}`,
            `reset-password:${currentToken}`,
            `reset-password:${otherUserToken}`,
          ],
        },
      },
    });
    const remainingIdentifiers = remaining.map((row) => row.identifier).sort();

    assert.deepEqual(
      remainingIdentifiers,
      [
        `reset-password:${currentToken}`,
        `reset-password:${otherUserToken}`,
      ].sort(),
      "invalidation must delete the prior token for the same User, keep the current token, and leave other Users' tokens untouched"
    );
  } finally {
    await prisma.verification.deleteMany({
      where: {
        identifier: {
          in: [
            `reset-password:${priorToken}`,
            `reset-password:${currentToken}`,
            `reset-password:${otherUserToken}`,
          ],
        },
      },
    });
    await prisma.$disconnect();
  }

  console.log("password reset token invalidation integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
