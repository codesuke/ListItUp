import type { Prisma, PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { lockAndFindSoleLeadLists, type SoleLeadList } from "@/lib/list/list-membership";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type { SoleLeadList };

export type RemoveWorkspaceMemberResult =
  | { status: "removed" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "cannot-remove-owner" }
  // `lists` is always present: populated for an Owner actor, empty for an
  // Admin actor who has no implicit List access (#91) — an empty array
  // rather than an optional field, so a caller can't mistake "omitted" for
  // "no Lists" and the two actor outcomes don't drift into parallel
  // optional shapes (see docs/agents/code-quality.md's discriminated-union
  // rule).
  | { status: "sole-lead-block"; count: number; lists: SoleLeadList[] };

export type LeaveWorkspaceResult =
  | { status: "left" }
  | { status: "not-found" }
  | { status: "owner-must-transfer-first" }
  // Unlike removeWorkspaceMember's Admin-actor branch, `lists` is always
  // populated here: the person leaving is the target, and anyone who leads
  // a List already has access to see it, so there's no viewer without
  // implicit access to protect against (contrast lockAndFindSoleLeadLists'
  // Owner-only identity-surfacing rule, which exists for the other actor
  // case).
  | { status: "sole-lead-block"; count: number; lists: SoleLeadList[] };

// The authority matrix for who may remove whom (#88, #91): the Owner may
// remove anyone but themself; an Admin may remove only a Member or Viewer,
// never a peer Admin. The `targetRole === "OWNER"` branch below is never
// reached from removeWorkspaceMember's own call site — that function
// always resolves an OWNER target through the more specific
// cannot-remove-owner status first — but it is live for this function's
// other caller, the Members page, which calls it directly to decide
// whether to render the Remove control at all (including for the Owner's
// own row), instead of restating the rule and risking a "forbidden" error
// after the click.
export function canActorRemoveTargetRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (targetRole === "OWNER") {
    return false;
  }
  if (actorRole === "OWNER") {
    return true;
  }
  return actorRole === "ADMIN" && (targetRole === "MEMBER" || targetRole === "VIEWER");
}

// A stale ListMember/Guest row for someone no longer in the Workspace would
// both leak List access (resolveListAccess does not require a current
// WorkspaceMember row) and sit as a ghost "other Lead" that lets a List's
// real last Lead believe they are covered. Item assignments, starred Lists
// and personal notes aren't access-bearing, but they're still the
// departing member's private leftovers in this Workspace and must go with
// them too (#91 acceptance criteria) — unlike the Items, Notes and
// attachments they authored, which stay attributed to them. Clearing all
// of it in the same transaction as the membership delete keeps the
// never-zero-Leads invariant meaningful after the exit, not just at the
// moment of it.
async function clearDepartingMemberArtifacts(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; userId: string }
): Promise<void> {
  const { workspaceId, userId } = input;
  await tx.listMember.deleteMany({ where: { userId, list: { workspaceId } } });
  await tx.guest.deleteMany({ where: { userId, list: { workspaceId } } });
  await tx.itemAssignee.deleteMany({ where: { userId, item: { list: { workspaceId } } } });
  await tx.starred.deleteMany({ where: { userId, list: { workspaceId } } });
  await tx.personalNote.deleteMany({ where: { userId, item: { list: { workspaceId } } } });
}

// An Owner or Admin can remove anyone the authority matrix above allows.
// Removal respects the never-zero-Leads invariant the same way a demotion
// to Viewer does (workspace-member-roles.ts, #99): it's blocked while the
// target is the sole Lead of any List in this Workspace — reused via
// lockAndFindSoleLeadLists, which locks those Lists so a concurrent exit or
// List-role change can't both read a stale "not blocked" snapshot (#98).
// The blocked result carries the actual Lists only for an Owner actor, who
// already has implicit access to every List in the Workspace (ADR 0017);
// an Admin — who has no implicit List access — gets only the count and
// must ask the Owner (#91).
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

  if (!canActorRemoveTargetRole(actingMembership.role, targetMembership.role)) {
    return { status: "forbidden" };
  }

  return database.$transaction(async (tx) => {
    const soleLeadLists = await lockAndFindSoleLeadLists(tx, { workspaceId, userId: targetUserId });
    if (soleLeadLists.length > 0) {
      const lists = actingMembership.role === "OWNER" ? soleLeadLists : [];
      return { status: "sole-lead-block", count: soleLeadLists.length, lists };
    }

    await clearDepartingMemberArtifacts(tx, { workspaceId, userId: targetUserId });
    await tx.workspaceMember.deleteMany({ where: { workspaceId, userId: targetUserId } });
    return { status: "removed" };
  });
}

// Leaving is removal of oneself: the same sole-Lead block and cleanup
// apply (#98, #91). The Owner is refused and must transfer ownership first
// (#88 user story 16) so a Workspace is never left without one. Unlike
// removeWorkspaceMember, the sole-Lead block always carries the List names
// (not just a count): the person leaving already has access to every List
// they lead, so there's no one here to withhold identities from (#93).
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
    const soleLeadLists = await lockAndFindSoleLeadLists(tx, { workspaceId, userId });
    if (soleLeadLists.length > 0) {
      return { status: "sole-lead-block", count: soleLeadLists.length, lists: soleLeadLists };
    }

    await clearDepartingMemberArtifacts(tx, { workspaceId, userId });
    await tx.workspaceMember.deleteMany({ where: { workspaceId, userId } });
    return { status: "left" };
  });
}
