import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  INBOX_LIST_NAME,
  PERSONAL_WORKSPACE_NAME,
} from "@/lib/auth/auth-config";

const UNIQUE_CONSTRAINT_VIOLATION_CODE = "P2002";

function isOwnerIdUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const prismaError = error as { code?: unknown; meta?: { target?: unknown } };

  return (
    prismaError.code === UNIQUE_CONSTRAINT_VIOLATION_CODE &&
    Array.isArray(prismaError.meta?.target) &&
    prismaError.meta.target.includes("ownerId")
  );
}

export async function provisionPersonalWorkspace(
  database: PrismaClient,
  userId: string
): Promise<void> {
  const user = await database.user.findUnique({ where: { id: userId } });

  if (!user || !user.emailVerified) {
    return;
  }

  try {
    await database.workspace.create({
      data: {
        id: randomUUID(),
        name: PERSONAL_WORKSPACE_NAME,
        ownerId: userId,
        lists: {
          create: [{ id: randomUUID(), name: INBOX_LIST_NAME, isInbox: true }],
        },
      },
    });
  } catch (error) {
    if (isOwnerIdUniqueConstraintViolation(error)) {
      return;
    }

    throw error;
  }
}
