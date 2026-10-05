import type { ListStatus, PrismaClient } from "@/generated/prisma/client";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type ListSummary = {
  id: string;
  name: string;
  description: string | null;
  status: ListStatus;
  isInbox: boolean;
  archivedAt: Date | null;
  isStarredByViewer: boolean;
  memberCount: number;
};

export type BrowseListsInput = {
  userId: string;
  workspaceId: string;
  search?: string;
  status?: ListStatus;
  memberUserId?: string;
  starredOnly?: boolean;
  // false (default) = the browsing page's normal tab; true = the Archived
  // tab (#26).
  archived?: boolean;
};

// Visibility here mirrors lib/permissions/'s resolveListAccess resolution
// order (ADR 0016: the Workspace Owner sees every List; everyone else,
// including an Admin, only Lists they're an explicit Member or Guest of)
// but as one set-based query rather than one resolveListAccess() call per
// List, since the browsing page needs to filter/search across a
// Workspace's full List set efficiently.
export async function browseLists(
  database: PrismaClient,
  input: BrowseListsInput
): Promise<ListSummary[]> {
  const { userId, workspaceId, search, status, memberUserId, starredOnly, archived = false } = input;

  // Checked independently of WorkspaceMember below since a Guest (who has
  // no WorkspaceMember row) must also see no Lists once the Workspace is
  // deleted (#76).
  const workspace = await database.workspace.findUnique({
    where: { id: workspaceId },
    select: { deletedAt: true },
  });
  if (!workspace || isDeletedWorkspace(workspace)) {
    return [];
  }

  const workspaceMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  const canSeeEveryList = workspaceMembership?.role === "OWNER";

  const visibilityFilter = canSeeEveryList
    ? {}
    : { OR: [{ members: { some: { userId } } }, { guests: { some: { userId } } }] };

  const lists = await database.list.findMany({
    where: {
      workspaceId,
      archivedAt: archived ? { not: null } : null,
      ...(status ? { status } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(memberUserId ? { members: { some: { userId: memberUserId } } } : {}),
      ...(starredOnly ? { starredBy: { some: { userId } } } : {}),
      ...visibilityFilter,
    },
    include: {
      members: { select: { userId: true } },
      starredBy: { where: { userId }, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    status: list.status,
    isInbox: list.isInbox,
    archivedAt: list.archivedAt,
    isStarredByViewer: list.starredBy.length > 0,
    memberCount: list.members.length,
  }));
}
