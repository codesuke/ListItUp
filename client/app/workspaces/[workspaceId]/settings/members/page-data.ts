import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { canManageWorkspace, canViewWorkspaceMembers } from "@/lib/permissions/workspace-access";

import { byRoleThenName } from "../page-data";

export type WorkspaceMembersPageMember = {
  userId: string;
  name: string;
  role: WorkspaceRole;
};

export type PendingWorkspaceInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedByName: string | null;
  expiresAt: Date;
  isExpired: boolean;
};

export type WorkspaceMembersPageData = {
  workspaceName: string;
  members: WorkspaceMembersPageMember[];
  canManageInvitations: boolean;
  pendingInvitations: PendingWorkspaceInvitation[];
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

  // Only Owner and Admin see Pending Invitations (docs/Specs-Planned/
  // workspace-invitations.md) — Member and Viewer get the member list only.
  const canManageInvitations = canManageWorkspace(membership.role);
  const now = new Date();
  const pendingInvitations = canManageInvitations
    ? (
        await database.workspaceInvitation.findMany({
          where: { workspaceId, acceptedAt: null },
          include: { invitedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      ).map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitedByName: invitation.invitedBy?.name ?? null,
        expiresAt: invitation.expiresAt,
        isExpired: invitation.expiresAt <= now,
      }))
    : [];

  return {
    workspaceName: membership.workspace.name,
    members,
    canManageInvitations,
    pendingInvitations,
  };
}
