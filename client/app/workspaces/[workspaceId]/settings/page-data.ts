import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";

export type WorkspaceSettingsMember = {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
};

export type WorkspaceSettingsPageData = {
  workspaceId: string;
  workspaceName: string;
  viewerRole: WorkspaceRole;
  members: WorkspaceSettingsMember[];
};

// Display order settled by #58: Owner first, then Admin, Member, Viewer,
// each alphabetical by name — not Postgres enum declaration order, which
// isn't a documented/stable sort key to rely on.
const ROLE_DISPLAY_ORDER: Record<WorkspaceRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
  VIEWER: 3,
};

function byRoleThenName(
  a: WorkspaceSettingsMember,
  b: WorkspaceSettingsMember
): number {
  return (
    ROLE_DISPLAY_ORDER[a.role] - ROLE_DISPLAY_ORDER[b.role] ||
    a.name.localeCompare(b.name)
  );
}

// Kept separate from the page component itself, and taking an injected
// PrismaClient rather than importing the app's shared singleton, so the
// data-loading and visibility logic can be exercised directly in a smoke
// test without a real Next.js request scope and without lib/prisma.ts's
// server-only guard, which throws under plain tsx execution (see
// Architecture.md).
export async function loadWorkspaceSettingsPageData(
  database: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<WorkspaceSettingsPageData | null> {
  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });

  if (
    !membership ||
    !canAccessWorkspaceSettings({
      role: membership.role,
      workspaceKind: membership.workspace.kind,
    })
  ) {
    return null;
  }

  const memberRows = await database.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const members = memberRows
    .map((row) => ({
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      role: row.role,
    }))
    .sort(byRoleThenName);

  return {
    workspaceId,
    workspaceName: membership.workspace.name,
    viewerRole: membership.role,
    members,
  };
}
