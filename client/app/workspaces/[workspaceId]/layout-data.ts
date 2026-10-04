import type { PrismaClient } from "@/generated/prisma/client";
import { browseLists } from "@/lib/list/list-browsing";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";

export type WorkspaceNavEntry = { id: string; name: string };

export type WorkspaceNavData = {
  switchableWorkspaces: WorkspaceNavEntry[];
  personalSpace: WorkspaceNavEntry | null;
  unreadNotificationCount: number;
  // The current Workspace's Lists section in the sidebar
  // (design-mocks/list-dashboard) — visibility-filtered the same way
  // Home's Recent Lists widget is (lib/list/list-browsing.ts).
  lists: WorkspaceNavEntry[];
  // Whether the current User sees the Settings nav entry for the current
  // Workspace (#58: Owner/Admin of a SHARED Workspace only).
  canManageWorkspaceSettings: boolean;
};

// Kept separate from layout.tsx itself, and taking an injected PrismaClient
// rather than importing the app's shared singleton, so the switcher/Personal
// Space query logic can be exercised directly in a smoke test without a real
// Next.js request scope and without lib/prisma.ts's server-only guard, which
// throws under plain tsx execution (see Architecture.md).
export async function loadWorkspaceNavData(
  database: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<WorkspaceNavData> {
  const [switchableMemberships, personalMembership, unreadNotificationCount, lists, currentMembership] =
    await Promise.all([
      database.workspaceMember.findMany({
        where: { userId, workspace: { kind: "SHARED", deletedAt: null } },
        include: { workspace: { select: { id: true, name: true } } },
        orderBy: { workspace: { name: "asc" } },
      }),
      database.workspaceMember.findFirst({
        where: { userId, workspace: { kind: "PERSONAL" } },
        include: { workspace: { select: { id: true, name: true } } },
      }),
      countUnreadNotifications(database, userId),
      browseLists(database, { userId, workspaceId }),
      database.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { workspace: { select: { kind: true } } },
      }),
    ]);

  return {
    switchableWorkspaces: switchableMemberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
    })),
    personalSpace: personalMembership
      ? { id: personalMembership.workspace.id, name: personalMembership.workspace.name }
      : null,
    unreadNotificationCount,
    lists: lists.map((list) => ({ id: list.id, name: list.name })),
    canManageWorkspaceSettings: canAccessWorkspaceSettings({
      role: currentMembership?.role,
      workspaceKind: currentMembership?.workspace.kind ?? "SHARED",
    }),
  };
}
