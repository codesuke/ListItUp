import type { PrismaClient } from "@/generated/prisma/client";

const ALERT_DEDUPLICATION_MILLISECONDS = 24 * 60 * 60_000;
const SECURITY_EVENT_RETENTION_MILLISECONDS = 90 * 24 * 60 * 60_000;
const UNVERIFIED_USER_RETENTION_MILLISECONDS = 7 * 24 * 60 * 60_000;

export interface SecurityAlert {
  subject: string;
  title: string;
  email?: string;
  ipAddress?: string;
}

export interface SecurityAlertTransport {
  send(alert: SecurityAlert): Promise<void>;
}

export interface SecurityAlertService {
  send(alert: SecurityAlert): Promise<boolean>;
}

export function createSecurityAlertService(
  database: PrismaClient,
  transport: SecurityAlertTransport
): SecurityAlertService {
  return {
    send: (alert) => sendDeduplicatedSecurityAlert(database, transport, alert),
  };
}

export async function sendDeduplicatedSecurityAlert(
  database: PrismaClient,
  transport: SecurityAlertTransport,
  alert: SecurityAlert,
  now: Date = new Date()
): Promise<boolean> {
  const existing = await database.securityAlertDispatch.findUnique({
    where: { subject: alert.subject },
  });
  if (
    existing &&
    existing.alertedAt.getTime() >
      now.getTime() - ALERT_DEDUPLICATION_MILLISECONDS
  ) {
    return false;
  }

  await transport.send(alert);
  await database.securityAlertDispatch.upsert({
    where: { subject: alert.subject },
    create: { subject: alert.subject, alertedAt: now },
    update: { alertedAt: now },
  });
  return true;
}

export async function cleanExpiredSecurityRecords(
  database: PrismaClient,
  now: Date = new Date()
): Promise<{ securityEvents: number; unverifiedUsers: number }> {
  const [securityEvents, unverifiedUsers] = await Promise.all([
    database.securityEvent.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - SECURITY_EVENT_RETENTION_MILLISECONDS),
        },
      },
    }),
    database.user.deleteMany({
      where: {
        emailVerified: false,
        createdAt: {
          lt: new Date(now.getTime() - UNVERIFIED_USER_RETENTION_MILLISECONDS),
        },
      },
    }),
  ]);
  return {
    securityEvents: securityEvents.count,
    unverifiedUsers: unverifiedUsers.count,
  };
}

export function hasSchedulerAuthorization(
  authorization: string | null,
  schedulerSecret: string
): boolean {
  return authorization === `Bearer ${schedulerSecret}`;
}
