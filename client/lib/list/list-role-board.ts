import { randomUUID } from "node:crypto";

import type { ListMemberRole, PrismaClient } from "@/generated/prisma/client";
import { lockAndInspectListMember } from "@/lib/list/list-membership";
import { isListArchived } from "@/lib/list/list-visibility";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type ListRoleBoardRole = ListMemberRole | "GUEST";

export type MoveListRoleAssignmentResult =
  | { status: "moved" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "user-lacks-workspace-membership" }
  | { status: "last-lead" }
  | { status: "list-archived" };

// The Overview tab's Roles kanban lets a drag move a person straight
// between List Lead/Member/Viewer and Guest. Gated at the same "LEAD"
// threshold as the rest of the Roles panel's per-row Add/Remove controls
// (ADR 0016 removed the separate, stricter Owner/Admin-only "ADMIN" access
// level this used to be scoped to).
const REQUIRED_ACCESS_LEVEL = "LEAD";

export async function moveListRoleAssignment(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; userId: string; toRole: ListRoleBoardRole }
): Promise<MoveListRoleAssignmentResult> {
  const { actorUserId, listId, userId, toRole } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  if (isListArchived(list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  if (toRole === "GUEST") {
    return database.$transaction(async (tx) => {
      const { isLastLead } = await lockAndInspectListMember(tx, { listId, userId });
      if (isLastLead) {
        return { status: "last-lead" };
      }

      await tx.listMember.deleteMany({ where: { listId, userId } });
      await tx.guest.upsert({
        where: { listId_userId: { listId, userId } },
        create: { id: randomUUID(), listId, userId },
        update: {},
      });
      return { status: "moved" };
    });
  }

  const workspaceMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: list.workspaceId, userId } },
  });
  if (!workspaceMembership) {
    return { status: "user-lacks-workspace-membership" };
  }

  return database.$transaction(async (tx) => {
    const { isLastLead } = await lockAndInspectListMember(tx, { listId, userId });
    if (isLastLead && toRole !== "LEAD") {
      return { status: "last-lead" };
    }

    await tx.guest.deleteMany({ where: { listId, userId } });
    await tx.listMember.upsert({
      where: { listId_userId: { listId, userId } },
      create: { id: randomUUID(), listId, userId, role: toRole },
      update: { role: toRole },
    });

    return { status: "moved" };
  });
}
