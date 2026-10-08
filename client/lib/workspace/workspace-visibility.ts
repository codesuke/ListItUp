import type { Prisma } from "@/generated/prisma/client";

// The single "is this Workspace visible to a member" filter (#76,
// part of #74's restore-window spec). Spread ACTIVE_WORKSPACE_WHERE into
// any Prisma query that resolves a Workspace, directly or through a
// relation, so a newly added query excludes a Deleted Workspace by default
// rather than needing every call site to remember to. Use isDeletedWorkspace
// instead when a Workspace (or its deletedAt field) is already in hand from
// an earlier query, to avoid a second round trip just to re-check it.
export const ACTIVE_WORKSPACE_WHERE: Prisma.WorkspaceWhereInput = { deletedAt: null };

export function isDeletedWorkspace(workspace: { deletedAt: Date | null }): boolean {
  return workspace.deletedAt !== null;
}
