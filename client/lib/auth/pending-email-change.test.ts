import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  clearPendingEmailChange,
  recordPendingEmailChange,
  resolvePendingEmailChange,
} from "./pending-email-change";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "pending email change integration test skipped: DATABASE_URL is not set"
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
  const oldEmail = `old-${randomUUID()}@example.test`;
  const firstNewEmail = `new-${randomUUID()}@example.test`;
  const secondNewEmail = `newer-${randomUUID()}@example.test`;

  try {
    await recordPendingEmailChange(prisma, userId, oldEmail, firstNewEmail, 24);

    const resolvedFirst = await resolvePendingEmailChange(
      prisma,
      firstNewEmail
    );
    assert.deepEqual(resolvedFirst, { userId, oldEmail });

    // Requesting a second change before the first completes must invalidate it.
    await recordPendingEmailChange(
      prisma,
      userId,
      oldEmail,
      secondNewEmail,
      24
    );
    assert.equal(await resolvePendingEmailChange(prisma, firstNewEmail), null);
    assert.deepEqual(await resolvePendingEmailChange(prisma, secondNewEmail), {
      userId,
      oldEmail,
    });

    await clearPendingEmailChange(prisma, secondNewEmail);
    assert.equal(await resolvePendingEmailChange(prisma, secondNewEmail), null);
  } finally {
    await prisma.verification.deleteMany({
      where: {
        identifier: {
          in: [
            `email-change:${firstNewEmail}`,
            `email-change:${secondNewEmail}`,
          ],
        },
      },
    });
    await prisma.$disconnect();
  }

  console.log("pending email change integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
