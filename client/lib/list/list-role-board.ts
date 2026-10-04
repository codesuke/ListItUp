import { randomUUID } from "node:crypto";

import type { ListMemberRole, PrismaClient } from "@/generated/prisma/client";
import { resolveListAccess } from "@/lib/permissions/list-access";

export type ListRoleBoardRole = ListMemberRole | "GUEST";

export type MoveListRoleAssignmentResult =
  | { status: "moved" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "user-lacks-workspace-membership" };

// The Overview tab's Roles kanban lets a drag move a person straight
// between List Lead/Member/Viewer and Guest. Scoped to Workspace
// Owner/Admin (ListAccessLevel "ADMIN") rather than the "LEAD" threshold
// the rest of the Roles panel uses — dragging is a coarser, faster-to-fat-
// finger action than the panel's per-row Add/Remove controls.
const REQUIRED_ACCESS_LEVEL = "ADMIN";

export async function moveListRoleAssignment(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; userId: string; toRole: ListRoleBoardRole }
): Promise<MoveListRoleAssignmentResult> {
  const { actorUserId, listId, userId, toRole } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (access !== REQUIRED_ACCESS_LEVEL) {
    return { status: "forbidden" };
  }

  if (toRole === "GUEST") {
    await database.listMember.deleteMany({ where: { listId, userId } });
    await database.guest.upsert({
      where: { listId_userId: { listId, userId } },
      create: { id: randomUUID(), listId, userId },
      update: {},
    });
    return { status: "moved" };
  }

  const workspaceMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: list.workspaceId, userId } },
  });
  if (!workspaceMembership) {
    return { status: "user-lacks-workspace-membership" };
  }

  await database.guest.deleteMany({ where: { listId, userId } });
  await database.listMember.upsert({
    where: { listId_userId: { listId, userId } },
    create: { id: randomUUID(), listId, userId, role: toRole },
    update: { role: toRole },
  });

  return { status: "moved" };
}
