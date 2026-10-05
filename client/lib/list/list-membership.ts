import { randomUUID } from "node:crypto";

import type { ListMemberRole, Prisma, PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type AddListMemberResult =
  | { status: "added" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "user-lacks-workspace-membership" }
  | { status: "viewer-ceiling" };

export type RemoveListMemberResult =
  | { status: "removed" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "last-lead" };

export type ChangeListMemberRoleResult =
  | { status: "changed" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "member-not-found" }
  | { status: "last-lead" }
  | { status: "viewer-ceiling" };

// A List Lead or the Workspace Owner (implicit Lead-equivalent access) can
// add/remove a List-level Member or Viewer (#28), or change an existing
// member's role between Lead/Member/Viewer (#95). A Workspace Admin has no
// implicit access (ADR 0016) and can only act once given an explicit List
// role of their own.
const REQUIRED_ACCESS_LEVEL = "LEAD";

// A Workspace Viewer is a permission ceiling: they can only ever hold the
// List Viewer role, never Lead or Member (#96).
function exceedsViewerCeiling(workspaceRole: WorkspaceRole | undefined, role: ListMemberRole): boolean {
  return workspaceRole === "VIEWER" && role !== "VIEWER";
}

// Locks the List row so a check-then-write against its Lead count
// serializes against any other concurrent change to the same List's Leads
// — two simultaneous demotions of the last two Leads must leave exactly one
// successful (#95) — then reports the User's current List role and whether
// they are that List's only explicit Lead. Must run inside the transaction
// that performs the guarded write, before any other read in that
// transaction, so every caller sees a consistent post-lock snapshot.
export async function lockAndInspectListMember(
  tx: Prisma.TransactionClient,
  input: { listId: string; userId: string }
): Promise<{ currentRole: ListMemberRole | null; isLastLead: boolean }> {
  const { listId, userId } = input;
  await tx.$queryRaw`SELECT id FROM "list" WHERE id = ${listId} FOR UPDATE`;

  const member = await tx.listMember.findUnique({ where: { listId_userId: { listId, userId } } });
  const currentRole = member?.role ?? null;

  if (currentRole !== "LEAD") {
    return { currentRole, isLastLead: false };
  }

  const remainingLeads = await tx.listMember.count({
    where: { listId, role: "LEAD", userId: { not: userId } },
  });

  return { currentRole, isLastLead: remainingLeads === 0 };
}

// A ListMember row may only reference a User who already holds a
// Workspace-level membership in that List's Workspace (ADR 0009) — Guest is
// the only path to List access without one.
export async function addListMember(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; userId: string; role: ListMemberRole }
): Promise<AddListMemberResult> {
  const { actorUserId, listId, userId, role } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const workspaceMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: list.workspaceId, userId } },
  });

  if (!workspaceMembership) {
    return { status: "user-lacks-workspace-membership" };
  }

  if (exceedsViewerCeiling(workspaceMembership.role, role)) {
    return { status: "viewer-ceiling" };
  }

  const existingMembership = await database.listMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });

  // Adding an existing Lead must never demote them — a routine re-add is a
  // no-op for their role, not a silent downgrade (#95). Role changes go
  // through changeListMemberRole instead, which guards the last-Lead case.
  if (existingMembership?.role === "LEAD") {
    return { status: "added" };
  }

  await database.listMember.upsert({
    where: { listId_userId: { listId, userId } },
    create: { id: randomUUID(), listId, userId, role },
    update: { role },
  });

  return { status: "added" };
}

export async function removeListMember(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; userId: string }
): Promise<RemoveListMemberResult> {
  const { actorUserId, listId, userId } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  return database.$transaction(async (tx) => {
    const { isLastLead } = await lockAndInspectListMember(tx, { listId, userId });
    if (isLastLead) {
      return { status: "last-lead" };
    }

    await tx.listMember.deleteMany({ where: { listId, userId } });
    return { status: "removed" };
  });
}

// Promotes a Member/Viewer to Lead, demotes a Lead to Member/Viewer, or lets
// a Lead step down themselves — the Roles panel's "Make Lead" and "Step
// down" controls, and a Lead demoting a fellow Lead, all go through this one
// guarded path so the List can never end up with zero Leads. There's no
// dedicated "transfer Lead" action; a handover is promote-then-step-down
// (#95).
export async function changeListMemberRole(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; userId: string; role: ListMemberRole }
): Promise<ChangeListMemberRoleResult> {
  const { actorUserId, listId, userId, role } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const workspaceMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: list.workspaceId, userId } },
  });
  if (exceedsViewerCeiling(workspaceMembership?.role, role)) {
    return { status: "viewer-ceiling" };
  }

  return database.$transaction(async (tx) => {
    const { currentRole, isLastLead } = await lockAndInspectListMember(tx, { listId, userId });
    if (currentRole === null) {
      return { status: "member-not-found" };
    }
    if (isLastLead && role !== "LEAD") {
      return { status: "last-lead" };
    }

    await tx.listMember.update({ where: { listId_userId: { listId, userId } }, data: { role } });
    return { status: "changed" };
  });
}
