import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { canManageWorkspace } from "@/lib/permissions/workspace-access";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type CreateListResult =
  | { status: "created"; listId: string }
  | { status: "creator-lacks-workspace-membership" }
  | { status: "creator-lacks-required-role" };

// Lists are private by default (ADR 0009): the creator becomes the List's
// first Lead and no other Workspace Member gains access from this call.
//
// List creation happens before the List exists, so it can't be authorized
// through lib/permissions/'s List-access resolver (#22) — it checks the
// creator's Workspace role directly instead.
export async function createList(
  database: PrismaClient,
  input: { workspaceId: string; creatorUserId: string; name: string }
): Promise<CreateListResult> {
  const { workspaceId, creatorUserId, name } = input;

  return database.$transaction(async (tx) => {
    const creatorMembership = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: creatorUserId } },
      include: { workspace: { select: { deletedAt: true } } },
    });

    if (!creatorMembership) {
      return { status: "creator-lacks-workspace-membership" };
    }

    if (isDeletedWorkspace(creatorMembership.workspace) || !canManageWorkspace(creatorMembership.role)) {
      return { status: "creator-lacks-required-role" };
    }

    const list = await tx.list.create({
      data: {
        id: randomUUID(),
        workspaceId,
        name,
        members: {
          create: [{ id: randomUUID(), userId: creatorUserId, role: "LEAD" }],
        },
      },
    });

    return { status: "created", listId: list.id };
  });
}
