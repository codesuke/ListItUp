import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { canManageWorkspace } from "@/lib/permissions/workspace-access";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type CreateLabelResult =
  | { status: "created"; labelId: string }
  | { status: "workspace-not-found" }
  | { status: "forbidden" }
  | { status: "duplicate-name" };

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

export async function createLabel(
  database: PrismaClient,
  input: { actorUserId: string; workspaceId: string; name: string }
): Promise<CreateLabelResult> {
  const { actorUserId, workspaceId, name } = input;

  const workspace = await database.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    return { status: "workspace-not-found" };
  }
  if (isDeletedWorkspace(workspace)) {
    return { status: "forbidden" };
  }

  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: actorUserId } },
  });
  if (!membership || !canManageWorkspace(membership.role)) {
    return { status: "forbidden" };
  }

  try {
    const label = await database.label.create({ data: { id: randomUUID(), workspaceId, name } });
    return { status: "created", labelId: label.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate-name" };
    }
    throw error;
  }
}
