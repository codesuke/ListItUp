import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import {
  cleanExpiredSecurityRecords,
  hasSchedulerAuthorization,
  sendDeduplicatedSecurityAlert,
  type SecurityAlert,
  type SecurityAlertTransport,
} from "./security-operations";

const DAY = 24 * 60 * 60_000;

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL must be set.");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const now = new Date("2026-07-21T12:00:00.000Z");
  const subject = `password-warning:${randomUUID()}`;
  const sent: SecurityAlert[] = [];
  const transport: SecurityAlertTransport = {
    async send(alert) {
      sent.push(alert);
    },
  };
  const oldUserId = randomUUID();
  const oldEventId = randomUUID();

  try {
    const alert = {
      subject,
      title: "Repeated password failures",
      email: "raw@example.test",
      ipAddress: "198.51.100.10",
    };
    assert.equal(
      await sendDeduplicatedSecurityAlert(prisma, transport, alert, now),
      true
    );
    assert.equal(
      await sendDeduplicatedSecurityAlert(
        prisma,
        transport,
        alert,
        new Date(now.getTime() + DAY - 1)
      ),
      false
    );
    assert.equal(sent[0]?.email, "raw@example.test");
    assert.equal(
      await sendDeduplicatedSecurityAlert(
        prisma,
        transport,
        alert,
        new Date(now.getTime() + DAY)
      ),
      true
    );

    await prisma.user.create({
      data: {
        id: oldUserId,
        name: "Old unverified",
        email: `old-${randomUUID()}@example.test`,
        createdAt: new Date(now.getTime() - 8 * DAY),
      },
    });
    await prisma.securityEvent.create({
      data: {
        id: oldEventId,
        type: "failed-password-sign-in",
        createdAt: new Date(now.getTime() - 91 * DAY),
      },
    });
    assert.deepEqual(await cleanExpiredSecurityRecords(prisma, now), {
      securityEvents: 1,
      unverifiedUsers: 1,
    });
    assert.equal(
      hasSchedulerAuthorization("Bearer scheduler-secret", "scheduler-secret"),
      true
    );
    assert.equal(hasSchedulerAuthorization(null, "scheduler-secret"), false);
  } finally {
    await prisma.securityAlertDispatch.deleteMany({ where: { subject } });
    await prisma.securityEvent.deleteMany({ where: { id: oldEventId } });
    await prisma.user.deleteMany({ where: { id: oldUserId } });
    await prisma.$disconnect();
  }
  console.log("security operations integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
