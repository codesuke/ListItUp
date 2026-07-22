import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { emailChangedNoticeEmail } from "@/lib/mailer/email-templates/email-changed-notice";
import { passwordChangedNoticeEmail } from "@/lib/mailer/email-templates/password-changed-notice";
import { recoveryCodeNoticeEmail } from "@/lib/mailer/email-templates/recovery-code-notice";
import { twoFactorNoticeEmail } from "@/lib/mailer/email-templates/two-factor-notice";
import type { EmailTemplate } from "@/lib/mailer/email-templates/render";
import type { Mailer } from "@/lib/mailer/mailer-core";
import type { SecurityAlertService } from "@/lib/security/security-operations";

const RETRY_DELAYS_IN_MILLISECONDS = [
  5 * 60_000,
  60 * 60_000,
  24 * 60 * 60_000,
] as const;
const FINAL_ATTEMPT_COUNT = RETRY_DELAYS_IN_MILLISECONDS.length + 1;

type SecurityNoticeType =
  | "email-changed-notice"
  | "password-changed-notice"
  | "recovery-code-notice"
  | "two-factor-notice";

export type SecurityNotice =
  | {
      recipient: string;
      type: "password-changed-notice";
    }
  | {
      recipient: string;
      type: "email-changed-notice";
      newEmail: string;
    }
  | {
      recipient: string;
      type: "recovery-code-notice";
      action: "regenerated" | "invalidated";
    }
  | {
      recipient: string;
      type: "two-factor-notice";
      action: "enabled" | "disabled";
    };

function securityNoticeTemplate(notice: SecurityNotice): EmailTemplate {
  switch (notice.type) {
    case "email-changed-notice":
      return emailChangedNoticeEmail({ newEmail: notice.newEmail });
    case "password-changed-notice":
      return passwordChangedNoticeEmail();
    case "recovery-code-notice":
      return recoveryCodeNoticeEmail({ reason: notice.action });
    case "two-factor-notice":
      return twoFactorNoticeEmail({ action: notice.action });
  }
}

function dueAt(now: Date, attemptCount: number): Date | null {
  const delay = RETRY_DELAYS_IN_MILLISECONDS[attemptCount - 1];

  return delay === undefined ? null : new Date(now.getTime() + delay);
}

function storedNoticeType(type: string): SecurityNoticeType | null {
  return type === "email-changed-notice" ||
    type === "password-changed-notice" ||
    type === "recovery-code-notice" ||
    type === "two-factor-notice"
    ? type
    : null;
}

function storedSecurityNotice(notice: {
  recipient: string;
  type: string;
  action: string | null;
  newEmail: string | null;
}): SecurityNotice | null {
  const type = storedNoticeType(notice.type);
  if (!type) {
    return null;
  }

  if (type === "email-changed-notice" && notice.newEmail) {
    return { recipient: notice.recipient, type, newEmail: notice.newEmail };
  }

  if (type === "password-changed-notice") {
    return { recipient: notice.recipient, type };
  }

  if (
    type === "recovery-code-notice" &&
    (notice.action === "regenerated" || notice.action === "invalidated")
  ) {
    return { recipient: notice.recipient, type, action: notice.action };
  }

  if (
    type === "two-factor-notice" &&
    (notice.action === "enabled" || notice.action === "disabled")
  ) {
    return { recipient: notice.recipient, type, action: notice.action };
  }

  return null;
}

export async function enqueueSecurityNotice(
  database: PrismaClient,
  notice: SecurityNotice,
  now: Date = new Date()
) {
  return database.securityNoticeOutbox.create({
    data: {
      id: randomUUID(),
      recipient: notice.recipient,
      type: notice.type,
      action: "action" in notice ? notice.action : null,
      newEmail: "newEmail" in notice ? notice.newEmail : null,
      nextAttemptAt: now,
    },
  });
}

export async function deliverDueSecurityNotices(
  database: PrismaClient,
  mailer: Mailer,
  now: Date = new Date(),
  securityAlerts?: SecurityAlertService
): Promise<void> {
  const notices = await database.securityNoticeOutbox.findMany({
    where: { status: "pending", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
  });

  for (const notice of notices) {
    const stored = storedSecurityNotice(notice);
    const attemptCount = notice.attemptCount + 1;
    const nextAttemptAt = dueAt(now, attemptCount);
    const result = stored
      ? await mailer.send({
          to: stored.recipient,
          type: stored.type,
          template: securityNoticeTemplate(stored),
        })
      : { ok: false as const };

    if (result.ok) {
      await database.securityNoticeOutbox.update({
        where: { id: notice.id },
        data: {
          attemptCount,
          lastAttemptAt: now,
          deliveredAt: now,
          status: "delivered",
        },
      });
      continue;
    }

    await database.securityNoticeOutbox.update({
      where: { id: notice.id },
      data: nextAttemptAt
        ? { attemptCount, lastAttemptAt: now, nextAttemptAt }
        : {
            attemptCount: FINAL_ATTEMPT_COUNT,
            lastAttemptAt: now,
            finalFailureAt: now,
            status: "failed",
          },
    });
    if (!nextAttemptAt) {
      await securityAlerts?.send({
        subject: `failed-security-notice:${notice.id}`,
        title: "Security notice delivery failed",
        email: notice.recipient,
      });
    }
  }
}

export async function enqueueAndDeliverSecurityNotice(
  database: PrismaClient,
  mailer: Mailer,
  notice: SecurityNotice,
  securityAlerts?: SecurityAlertService
): Promise<void> {
  await enqueueSecurityNotice(database, notice);
  await deliverDueSecurityNotices(database, mailer, new Date(), securityAlerts);
}
