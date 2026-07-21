import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import {
  grantPlatformOperator,
  listSecurityEventsForOperator,
  recordSecurityEvent,
  revokePlatformOperator,
} from "./platform-operations";

async function run() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set to run platform operations integration tests."
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const operatorId = randomUUID();
  const subjectId = randomUUID();

  try {
    await prisma.user.createMany({
      data: [
        {
          id: operatorId,
          name: "Platform Operator",
          email: `operator-${randomUUID()}@example.test`,
          emailVerified: true,
        },
        {
          id: subjectId,
          name: "Security Event Subject",
          email: `subject-${randomUUID()}@example.test`,
          emailVerified: true,
        },
      ],
    });

    await grantPlatformOperator(prisma, {
      userId: operatorId,
      grantedByUserId: operatorId,
    });
    await recordSecurityEvent(prisma, {
      type: "failed-password-sign-in",
      userId: subjectId,
      email: "subject@example.test",
      ipAddress: "198.51.100.10",
    });

    const events = await listSecurityEventsForOperator(prisma, operatorId);
    const event = events.find((candidate) => candidate.userId === subjectId);
    assert.equal(event?.email, "subject@example.test");
    assert.equal(event?.ipAddress, "198.51.100.10");

    await revokePlatformOperator(prisma, {
      userId: operatorId,
      revokedByUserId: operatorId,
    });
    await assert.rejects(
      () => listSecurityEventsForOperator(prisma, operatorId),
      /Platform Operator access is required/
    );
  } finally {
    await prisma.securityEvent.deleteMany({
      where: { userId: { in: [operatorId, subjectId] } },
    });
    await prisma.platformRoleAssignment.deleteMany({
      where: { userId: { in: [operatorId, subjectId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [operatorId, subjectId] } } });
    await prisma.$disconnect();
  }

  console.log("platform operations integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
