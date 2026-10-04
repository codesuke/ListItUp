import type { PrismaClient } from "@/generated/prisma/client";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

// The single resolution order settled by ADR 0009: Workspace Owner/Admin
// implicit access -> Workspace Viewer ceiling -> explicit List-level role ->
// Guest access -> no access. Every List-scoped authorization check in the
// app should call resolveListAccess() rather than querying
// WorkspaceMember/ListMember/Guest directly.
export type ListAccessLevel = "NONE" | "READ" | "WRITE" | "LEAD" | "ADMIN";

const LEVEL_ORDER: ListAccessLevel[] = ["NONE", "READ", "WRITE", "LEAD", "ADMIN"];

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
  // check (#76) — Owner/Admin implicit access, explicit List roles, and
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

  // Workspace Owner/Admin see every List in their Workspace, including
  // private ones, regardless of any explicit List-level row.
  if (workspaceMembership?.role === "OWNER" || workspaceMembership?.role === "ADMIN") {
    return "ADMIN";
  }

  let level: ListAccessLevel = listMembership
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
