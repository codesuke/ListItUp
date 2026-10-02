import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { canViewWorkspaceMembers } from "@/lib/permissions/workspace-access";

import { byRoleThenName } from "../page-data";

export type WorkspaceMembersPageMember = {
  userId: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceMembersPageData = {
  workspaceName: string;
  members: WorkspaceMembersPageMember[];
};

// Takes an injected PrismaClient for the same reason as the settings page's
// loader: it can be smoke-tested without lib/prisma.ts's server-only guard.
export async function loadWorkspaceMembersPageData(
  database: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<WorkspaceMembersPageData | null> {
  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });

  if (
    !membership ||
    !canViewWorkspaceMembers({
      role: membership.role,
      workspaceKind: membership.workspace.kind,
    })
  ) {
    return null;
  }

  const memberRows = await database.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { name: true } } },
  });

  const members = memberRows
    .map((row) => ({
      userId: row.userId,
      name: row.user.name,
      role: row.role,
    }))
    .sort(byRoleThenName);

  return { workspaceName: membership.workspace.name, members };
}
