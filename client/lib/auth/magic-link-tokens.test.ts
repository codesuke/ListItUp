import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { invalidateOtherMagicLinkTokens } from "./magic-link-tokens";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "magic link token invalidation integration test skipped: DATABASE_URL is not set"
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

  const email = `magic-link-${randomUUID()}@example.test`;
  const otherEmail = `magic-link-other-${randomUUID()}@example.test`;
  const priorToken = `prior-${randomUUID()}`;
  const currentToken = `current-${randomUUID()}`;
  const otherUserToken = `unrelated-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  try {
    await prisma.verification.createMany({
      data: [
        {
          id: randomUUID(),
          identifier: priorToken,
          value: JSON.stringify({ email }),
          expiresAt,
        },
        {
          id: randomUUID(),
          identifier: currentToken,
          value: JSON.stringify({ email }),
          expiresAt,
        },
        {
          id: randomUUID(),
          identifier: otherUserToken,
          value: JSON.stringify({ email: otherEmail }),
          expiresAt,
        },
      ],
    });

    await invalidateOtherMagicLinkTokens(prisma, email, currentToken);

    const remaining = await prisma.verification.findMany({
      where: { identifier: { in: [priorToken, currentToken, otherUserToken] } },
    });
    const remainingIdentifiers = remaining.map((row) => row.identifier).sort();

    assert.deepEqual(
      remainingIdentifiers,
      [currentToken, otherUserToken].sort(),
      "invalidation must delete the prior token for the same email, keep the current token, and leave other Users' tokens untouched"
    );
  } finally {
    await prisma.verification.deleteMany({
      where: { identifier: { in: [priorToken, currentToken, otherUserToken] } },
    });
    await prisma.$disconnect();
  }

  console.log("magic link token invalidation integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
