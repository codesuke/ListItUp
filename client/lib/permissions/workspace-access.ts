import type { WorkspaceKind, WorkspaceRole } from "@/generated/prisma/client";

// Whether a WorkspaceRole can manage Workspace-level concerns (members,
// invitations, settings) — the Owner/Admin "manage everything" tier from
// ADR 0009. Distinct from List-level access (see lib/permissions/list-access.ts).
export function canManageWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

// The Workspace Settings page (members, invitations, ownership transfer)
// only makes sense for a SHARED Workspace — a Personal Space always has
// exactly one OWNER member (lib/workspace/workspace-provisioning.ts) and
// nothing there to manage.
export function canAccessWorkspaceSettings(input: {
  role: WorkspaceRole | null | undefined;
  workspaceKind: WorkspaceKind;
}): boolean {
  return input.workspaceKind === "SHARED" && canManageWorkspace(input.role);
}

// The members list is read-only context for everyone in a SHARED Workspace
// (Viewers included); a Personal Space has no members page, and
// non-members get nothing.
export function canViewWorkspaceMembers(input: {
  role: WorkspaceRole | null | undefined;
  workspaceKind: WorkspaceKind;
}): boolean {
  return input.role != null && input.workspaceKind === "SHARED";
}

// Whether a WorkspaceRole grants implicit Lead-equivalent access to every
// List in the Workspace, bypassing any explicit List-level role (ADR 0016)
// — currently just the Owner. This is the exact counterpart to
// resolveListAccess's own inline `workspaceMembership?.role === "OWNER"`
// check (lib/permissions/list-access.ts): the two must never drift from
// each other, since this predicate exists so call sites that can't afford
// a resolveListAccess() call per List (list-browsing.ts, global-search.ts)
// can still ask the same question.
export function hasImplicitListAccess(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER";
}
