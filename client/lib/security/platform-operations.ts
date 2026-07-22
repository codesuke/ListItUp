import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

export class PlatformOperatorAuthorizationError extends Error {
  constructor() {
    super("Platform Operator access is required.");
  }
}

export interface GrantPlatformOperatorInput {
  userId: string;
  grantedByUserId: string;
}

export interface RevokePlatformOperatorInput {
  userId: string;
  revokedByUserId: string;
}

export interface RecordSecurityEventInput {
  type: string;
  userId?: string;
  email?: string;
  ipAddress?: string;
}

export async function grantPlatformOperator(
  database: PrismaClient,
  input: GrantPlatformOperatorInput
) {
  const activeAssignment = await database.platformRoleAssignment.findFirst({
    where: { userId: input.userId, revokedAt: null },
  });

  if (activeAssignment) {
    return activeAssignment;
  }

  return database.platformRoleAssignment.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      grantedByUserId: input.grantedByUserId,
    },
  });
}

export async function revokePlatformOperator(
  database: PrismaClient,
  input: RevokePlatformOperatorInput
) {
  const activeAssignment = await database.platformRoleAssignment.findFirst({
    where: { userId: input.userId, revokedAt: null },
  });

  if (!activeAssignment) {
    return null;
  }

  return database.platformRoleAssignment.update({
    where: { id: activeAssignment.id },
    data: { revokedAt: new Date(), revokedByUserId: input.revokedByUserId },
  });
}

export async function recordSecurityEvent(
  database: PrismaClient,
  input: RecordSecurityEventInput
) {
  return database.securityEvent.create({
    data: {
      id: randomUUID(),
      type: input.type,
      userId: input.userId,
      email: input.email,
      ipAddress: input.ipAddress,
    },
  });
}

export async function listSecurityEventsForOperator(
  database: PrismaClient,
  operatorId: string
) {
  const activeAssignment = await database.platformRoleAssignment.findFirst({
    where: { userId: operatorId, revokedAt: null },
    select: { id: true },
  });

  if (!activeAssignment) {
    throw new PlatformOperatorAuthorizationError();
  }

  return database.securityEvent.findMany({ orderBy: { createdAt: "desc" } });
}

export async function listFailedSecurityNoticesForOperator(
  database: PrismaClient,
  operatorId: string
) {
  const activeAssignment = await database.platformRoleAssignment.findFirst({
    where: { userId: operatorId, revokedAt: null },
    select: { id: true },
  });

  if (!activeAssignment) {
    throw new PlatformOperatorAuthorizationError();
  }

  return database.securityNoticeOutbox.findMany({
    where: { status: "failed" },
    orderBy: { finalFailureAt: "desc" },
  });
}
