import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

const IDENTIFIER_PREFIX = "email-change:";

function identifierFor(newEmail: string): string {
  return `${IDENTIFIER_PREFIX}${newEmail}`;
}

export interface PendingEmailChange {
  userId: string;
  oldEmail: string;
}

// Better Auth's changeEmail endpoint sends a verification link straight to
// the new address but has no concept of "notify the old address once
// confirmed" or "which User/old-email this belongs to" once the User row is
// updated. This tracks that mapping ourselves (see the sendVerificationEmail
// and databaseHooks.user.update.after wiring in auth-core.ts).
export async function recordPendingEmailChange(
  database: PrismaClient,
  userId: string,
  oldEmail: string,
  newEmail: string,
  expiresInHours: number
): Promise<void> {
  await database.verification.deleteMany({
    where: {
      identifier: { startsWith: IDENTIFIER_PREFIX },
      value: { startsWith: `${userId}:` },
    },
  });

  await database.verification.create({
    data: {
      id: randomUUID(),
      identifier: identifierFor(newEmail),
      value: `${userId}:${oldEmail}`,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    },
  });
}

export async function resolvePendingEmailChange(
  database: PrismaClient,
  newEmail: string
): Promise<PendingEmailChange | null> {
  const record = await database.verification.findFirst({
    where: { identifier: identifierFor(newEmail) },
  });

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  const separatorIndex = record.value.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  return {
    userId: record.value.slice(0, separatorIndex),
    oldEmail: record.value.slice(separatorIndex + 1),
  };
}

export async function clearPendingEmailChange(
  database: PrismaClient,
  newEmail: string
): Promise<void> {
  await database.verification.deleteMany({
    where: { identifier: identifierFor(newEmail) },
  });
}
