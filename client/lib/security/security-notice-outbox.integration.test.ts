import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import type {
  Mailer,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/mailer/mailer-core";
import {
  deliverDueSecurityNotices,
  enqueueSecurityNotice,
} from "./security-notice-outbox";

const MINUTE_IN_MILLISECONDS = 60_000;
const HOUR_IN_MILLISECONDS = 60 * MINUTE_IN_MILLISECONDS;

function addMinutes(time: Date, minutes: number): Date {
  return new Date(time.getTime() + minutes * MINUTE_IN_MILLISECONDS);
}

function addHours(time: Date, hours: number): Date {
  return new Date(time.getTime() + hours * HOUR_IN_MILLISECONDS);
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set to run security notice outbox tests."
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const recipient = `security-notice-${randomUUID()}@example.test`;
  const initialTime = new Date("2026-07-21T12:00:00.000Z");
  const sentEmails: SendEmailInput[] = [];
  const outcomes: SendEmailResult[] = [
    { ok: false, reason: "send-failed" },
    { ok: false, reason: "send-failed" },
    { ok: false, reason: "send-failed" },
    { ok: false, reason: "send-failed" },
  ];
  const mailer: Mailer = {
    async send(input) {
      sentEmails.push(input);
      const outcome = outcomes.shift();
      assert.ok(
        outcome,
        "a controlled mail outcome is required for every attempt"
      );
      return outcome;
    },
  };

  try {
    const notice = await enqueueSecurityNotice(
      prisma,
      {
        recipient,
        type: "two-factor-notice",
        action: "disabled",
      },
      initialTime
    );

    await deliverDueSecurityNotices(prisma, mailer, initialTime);
    let stored = await prisma.securityNoticeOutbox.findUniqueOrThrow({
      where: { id: notice.id },
    });
    assert.equal(stored.attemptCount, 1);
    assert.equal(
      stored.nextAttemptAt.toISOString(),
      addMinutes(initialTime, 5).toISOString()
    );

    await deliverDueSecurityNotices(prisma, mailer, addMinutes(initialTime, 4));
    assert.equal(
      sentEmails.length,
      1,
      "a notice is not retried before its scheduled time"
    );

    await deliverDueSecurityNotices(prisma, mailer, addMinutes(initialTime, 5));
    stored = await prisma.securityNoticeOutbox.findUniqueOrThrow({
      where: { id: notice.id },
    });
    assert.equal(stored.attemptCount, 2);
    assert.equal(
      stored.nextAttemptAt.toISOString(),
      addHours(addMinutes(initialTime, 5), 1).toISOString()
    );

    await deliverDueSecurityNotices(
      prisma,
      mailer,
      addHours(addMinutes(initialTime, 5), 1)
    );
    stored = await prisma.securityNoticeOutbox.findUniqueOrThrow({
      where: { id: notice.id },
    });
    assert.equal(stored.attemptCount, 3);
    assert.equal(
      stored.nextAttemptAt.toISOString(),
      addHours(addMinutes(initialTime, 5), 25).toISOString()
    );

    await deliverDueSecurityNotices(
      prisma,
      mailer,
      addHours(addMinutes(initialTime, 5), 25)
    );
    stored = await prisma.securityNoticeOutbox.findUniqueOrThrow({
      where: { id: notice.id },
    });
    assert.equal(stored.attemptCount, 4);
    assert.equal(stored.status, "failed");
    assert.ok(
      stored.finalFailureAt,
      "final failures remain available for operator follow-up"
    );
  } finally {
    await prisma.securityNoticeOutbox.deleteMany({ where: { recipient } });
    await prisma.$disconnect();
  }

  console.log("security notice outbox integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
