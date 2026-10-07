import type { PrismaClient } from "@/generated/prisma/client";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

// The single resolution order settled by ADR 0016 (superseding ADR 0009's
// Admin half): Workspace Owner implicit Lead-equivalent access -> Workspace
// Viewer ceiling -> explicit List-level role -> Guest access -> no access.
// A Workspace Admin has no implicit access and falls through to their
// explicit List role, if any. Every List-scoped authorization check in the
// app should call resolveListAccess() rather than querying
// WorkspaceMember/ListMember/Guest directly.
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

  const list = await database.list.findUnique({
    where: { id: listId },
    select: { workspaceId: true, workspace: { select: { deletedAt: true } } },
  });

  // A Deleted Workspace is treated as nonexistent for every List-scoped
  // check (#76) — the Owner's implicit access, explicit List roles, and
  // Guest grants all resolve to NONE rather than resolving normally.
  if (!list || isDeletedWorkspace(list.workspace)) {
    return "NONE";
  }

  const [workspaceMembership, listMembership, guestGrant] = await Promise.all([
    database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: list.workspaceId, userId } },
    }),
    database.listMember.findUnique({ where: { listId_userId: { listId, userId } } }),
    database.guest.findUnique({ where: { listId_userId: { listId, userId } } }),
  ]);

  // The Workspace Owner sees every List in their Workspace, including
  // private ones, with Lead-equivalent access regardless of any explicit
  // List-level row (ADR 0016). A Workspace Admin has no such implicit
  // access and falls through to their explicit List role below. This check
  // must never drift from hasImplicitListAccess()'s mirror of it
  // (lib/permissions/workspace-access.ts), which call sites that can't
  // afford a resolveListAccess() per List use instead.
  if (workspaceMembership?.role === "OWNER") {
    return "LEAD";
  }

  // A ListMember row only grants access when a WorkspaceMember row backs it
  // in this same Workspace — an orphaned ListMember (stale data, a bypassed
  // cleanup path) is treated as absent rather than trusted, falling through
  // to the Guest check below exactly as if no ListMember row existed. Guest
  // access has no WorkspaceMember by design and is untouched by this check.
  const hasBackingWorkspaceMembership = workspaceMembership !== null;

  let level: ListAccessLevel = listMembership && hasBackingWorkspaceMembership
    ? LIST_ROLE_TO_LEVEL[listMembership.role]
    : guestGrant
      ? "READ"
      : "NONE";

  // The Workspace Viewer ceiling caps everything below it at read-only, even
  // if a higher List-level role was separately granted.
  if (workspaceMembership?.role === "VIEWER" && level !== "NONE") {
    level = "READ";
  }

  return level;
}

// Export is a read, so the Viewer ceiling does not block it; a Guest is
// refused because the data would leave the system for someone with no
// Workspace identity (#72). resolveListAccess() reports READ for both a
// List Viewer and a Guest, so the two are told apart here by whether the
// User holds any Workspace or List role.
export async function canExportList(
  database: PrismaClient,
  input: { userId: string; listId: string }
): Promise<boolean> {
  const { userId, listId } = input;

  const access = await resolveListAccess(database, input);
  if (!meetsListAccessLevel(access, "READ")) {
    return false;
  }

  const list = await database.list.findUniqueOrThrow({
    where: { id: listId },
    select: { workspaceId: true },
  });
  const [workspaceMembership, listMembership] = await Promise.all([
    database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: list.workspaceId, userId } },
    }),
    database.listMember.findUnique({ where: { listId_userId: { listId, userId } } }),
  ]);

  return workspaceMembership !== null || listMembership !== null;
}
