import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { lockAndCountSoleLeadLists } from "@/lib/list/list-membership";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type RemoveWorkspaceMemberResult =
  | { status: "removed" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "cannot-remove-owner" }
  | { status: "sole-lead-block"; count: number };

export type LeaveWorkspaceResult =
  | { status: "left" }
  | { status: "not-found" }
  | { status: "owner-must-transfer-first" }
  | { status: "sole-lead-block"; count: number };

// A stale ListMember/Guest row for someone no longer in the Workspace would
// both leak List access (resolveListAccess does not require a current
// WorkspaceMember row) and sit as a ghost "other Lead" that lets a List's
// real last Lead believe they are covered. Clearing both in the same
// transaction as the membership delete keeps the never-zero-Leads
// invariant meaningful after the exit, not just at the moment of it. Item
// assignments, starred Lists and personal notes are not access-bearing and
// are left for the fuller cleanup in #91/#93.
async function clearWorkspaceListAccess(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; userId: string }
): Promise<void> {
  const { workspaceId, userId } = input;
  await tx.listMember.deleteMany({ where: { userId, list: { workspaceId } } });
  await tx.guest.deleteMany({ where: { userId, list: { workspaceId } } });
}

// An Owner or Admin can remove anyone but the Owner. Removal respects the
// never-zero-Leads invariant the same way a demotion to Viewer does
// (workspace-member-roles.ts, #99): it's blocked, with only the blocking
// List count surfaced, while the target is the sole Lead of any List in
// this Workspace — reused via lockAndCountSoleLeadLists, which locks those
// Lists so a concurrent exit or List-role change can't both read a stale
// "not blocked" snapshot (#98). Item assignments, starred Lists, personal
// notes, the finer Owner/Admin authority matrix, and removal notifications
// belong to the fuller "remove a member" slice (#91).
export async function removeWorkspaceMember(
  database: PrismaClient,
  input: { actingUserId: string; workspaceId: string; targetUserId: string }
): Promise<RemoveWorkspaceMemberResult> {
  const { actingUserId, workspaceId, targetUserId } = input;

  const actingMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: actingUserId } },
    include: { workspace: true },
  });

  if (
    !actingMembership ||
    isDeletedWorkspace(actingMembership.workspace) ||
    !canAccessWorkspaceSettings({
      role: actingMembership.role,
      workspaceKind: actingMembership.workspace.kind,
    })
  ) {
    return { status: "forbidden" };
  }

  const targetMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });

  if (!targetMembership) {
    return { status: "not-found" };
  }

  if (targetMembership.role === "OWNER") {
    return { status: "cannot-remove-owner" };
  }

  return database.$transaction(async (tx) => {
    const soleLeadListCount = await lockAndCountSoleLeadLists(tx, { workspaceId, userId: targetUserId });
    if (soleLeadListCount > 0) {
      return { status: "sole-lead-block", count: soleLeadListCount };
    }

    await clearWorkspaceListAccess(tx, { workspaceId, userId: targetUserId });
    await tx.workspaceMember.deleteMany({ where: { workspaceId, userId: targetUserId } });
    return { status: "removed" };
  });
}

// Leaving is removal of oneself: the same sole-Lead block applies (#98). The
// Owner is refused and must transfer ownership first (#88 user story 16) so
// a Workspace is never left without one. The fuller cleanup, and the
// redirect for a departing member whose active Workspace was this one,
// belong to #93.
export async function leaveWorkspace(
  database: PrismaClient,
  input: { workspaceId: string; userId: string }
): Promise<LeaveWorkspaceResult> {
  const { workspaceId, userId } = input;

  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });

  if (
    !membership ||
    isDeletedWorkspace(membership.workspace) ||
    membership.workspace.kind !== "SHARED"
  ) {
    return { status: "not-found" };
  }

  if (membership.role === "OWNER") {
    return { status: "owner-must-transfer-first" };
  }

  return database.$transaction(async (tx) => {
    const soleLeadListCount = await lockAndCountSoleLeadLists(tx, { workspaceId, userId });
    if (soleLeadListCount > 0) {
      return { status: "sole-lead-block", count: soleLeadListCount };
    }

    await clearWorkspaceListAccess(tx, { workspaceId, userId });
    await tx.workspaceMember.deleteMany({ where: { workspaceId, userId } });
    return { status: "left" };
  });
}
