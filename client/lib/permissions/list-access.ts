import type { PrismaClient } from "@/generated/prisma/client";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

// The single resolution order settled by ADR 0016 (superseding ADR 0009's
// Admin half) and simplified by ADR 0022 (dropping Guest access): Workspace
// Owner implicit Lead-equivalent access -> Workspace Viewer ceiling ->
// explicit List-level role -> no access. A Workspace Admin has no implicit
// access and falls through to their explicit List role, if any. Every
// List-scoped authorization check in the app should call resolveListAccess()
// rather than querying WorkspaceMember/ListMember directly.
export type ListAccessLevel = "NONE" | "READ" | "WRITE" | "LEAD";

const LEVEL_ORDER: ListAccessLevel[] = ["NONE", "READ", "WRITE", "LEAD"];

export function meetsListAccessLevel(
  level: ListAccessLevel,
  required: ListAccessLevel
): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(required);
}

const LIST_ROLE_TO_LEVEL = {
  LEAD: "LEAD",
  MEMBER: "WRITE",
  VIEWER: "READ",
} as const satisfies Record<string, ListAccessLevel>;

export async function resolveListAccess(
  database: PrismaClient,
  input: { userId: string; listId: string }
): Promise<ListAccessLevel> {
  const { userId, listId } = input;
  const levels = await resolveListAccessForMany(database, { userId, listIds: [listId] });
  return levels.get(listId) ?? "NONE";
}

// Batched sibling of resolveListAccess, used by every read surface that
// re-checks the viewer's *current* access per row rather than per single
// target (#107/ADR 0021: Notifications, My Tasks, Items I've Assigned) —
// one set of queries across every distinct List in the result set instead
// of one resolveListAccess() round trip per row. Implements the exact same
// resolution order as resolveListAccess, which delegates to this for a
// single List so the two can never drift apart.
export async function resolveListAccessForMany(
  database: PrismaClient,
  input: { userId: string; listIds: string[] }
): Promise<Map<string, ListAccessLevel>> {
  const { userId } = input;
  const listIds = [...new Set(input.listIds)];
  if (listIds.length === 0) {
    return new Map();
  }

  const lists = await database.list.findMany({
    where: { id: { in: listIds } },
    select: { id: true, workspaceId: true, workspace: { select: { deletedAt: true } } },
  });
  const listById = new Map(lists.map((list) => [list.id, list]));
  const workspaceIds = [...new Set(lists.map((list) => list.workspaceId))];

  const [workspaceMemberships, listMemberships] = await Promise.all([
    database.workspaceMember.findMany({ where: { workspaceId: { in: workspaceIds }, userId } }),
    database.listMember.findMany({ where: { listId: { in: listIds }, userId } }),
  ]);
  const workspaceMembershipByWorkspaceId = new Map(
    workspaceMemberships.map((membership) => [membership.workspaceId, membership])
  );
  const listMembershipByListId = new Map(listMemberships.map((membership) => [membership.listId, membership]));

  const levels = new Map<string, ListAccessLevel>();
  for (const listId of listIds) {
    const list = listById.get(listId);

    // A Deleted Workspace is treated as nonexistent for every List-scoped
    // check (#76) — the Owner's implicit access and explicit List roles
    // both resolve to NONE rather than resolving normally.
    if (!list || isDeletedWorkspace(list.workspace)) {
      levels.set(listId, "NONE");
      continue;
    }

    const workspaceMembership = workspaceMembershipByWorkspaceId.get(list.workspaceId);

    // The Workspace Owner sees every List in their Workspace, including
    // private ones, with Lead-equivalent access regardless of any explicit
    // List-level row (ADR 0016). A Workspace Admin has no such implicit
    // access and falls through to their explicit List role below. This
    // check must never drift from hasImplicitListAccess()'s mirror of it
    // (lib/permissions/workspace-access.ts), which call sites that can't
    // afford this batched resolution per List use instead.
    if (workspaceMembership?.role === "OWNER") {
      levels.set(listId, "LEAD");
      continue;
    }

    // A ListMember row only grants access when a WorkspaceMember row backs
    // it in this same Workspace — an orphaned ListMember (stale data, a
    // bypassed cleanup path) is treated as absent rather than trusted,
    // exactly as if no ListMember row existed.
    const hasBackingWorkspaceMembership = workspaceMembership !== undefined;
    const listMembership = listMembershipByListId.get(listId);

    let level: ListAccessLevel =
      listMembership && hasBackingWorkspaceMembership ? LIST_ROLE_TO_LEVEL[listMembership.role] : "NONE";

    // The Workspace Viewer ceiling caps everything below it at read-only,
    // even if a higher List-level role was separately granted.
    if (workspaceMembership?.role === "VIEWER" && level !== "NONE") {
      level = "READ";
    }

    levels.set(listId, level);
  }

  return levels;
}

// Export is a read, so the Viewer ceiling does not block it: anyone who can
// read the List may export it (#72).
export async function canExportList(
  database: PrismaClient,
  input: { userId: string; listId: string }
): Promise<boolean> {
  const access = await resolveListAccess(database, input);
  return meetsListAccessLevel(access, "READ");
}
