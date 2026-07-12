import type { PrismaClient } from "@/generated/prisma/client";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/auth-config";

export function canResendVerificationEmail(
  lastSentAt: Date | null,
  now: Date
): boolean {
  if (!lastSentAt) {
    return true;
  }

  const elapsedSeconds = (now.getTime() - lastSentAt.getTime()) / 1000;

  return elapsedSeconds >= VERIFICATION_RESEND_COOLDOWN_SECONDS;
}

export async function recordVerificationEmailSent(
  database: PrismaClient,
  email: string,
  sentAt: Date = new Date()
): Promise<void> {
  await database.verificationEmailThrottle.upsert({
    where: { identifier: email },
    create: { identifier: email, lastSentAt: sentAt },
    update: { lastSentAt: sentAt },
  });
}

export async function resendVerificationEmailIfAllowed(
  database: PrismaClient,
  sendVerificationEmail: (email: string) => Promise<void>,
  email: string,
  now: Date = new Date()
): Promise<void> {
  const throttle = await database.verificationEmailThrottle.findUnique({
    where: { identifier: email },
  });

  if (!canResendVerificationEmail(throttle?.lastSentAt ?? null, now)) {
    return;
  }

  await sendVerificationEmail(email);
}
