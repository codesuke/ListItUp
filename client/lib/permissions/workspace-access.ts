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
