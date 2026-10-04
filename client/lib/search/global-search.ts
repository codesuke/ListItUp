import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type SearchedList = {
  id: string;
  name: string;
};

export type SearchedItem = {
  id: string;
  title: string;
  listId: string;
  listName: string;
};

export type SearchedMember = {
  userId: string;
  name: string;
};

export type GlobalSearchResult = {
  lists: SearchedList[];
  items: SearchedItem[];
  members: SearchedMember[];
};

export type GlobalSearchInput = {
  userId: string;
  workspaceId: string;
  query: string;
};

// Caps and ordering settled in docs/QnA/global-search-command-palette.md
// (#9): Lists/Items by updatedAt desc, Members by name asc.
const RESULTS_PER_CATEGORY = 5;

const EMPTY_RESULT: GlobalSearchResult = { lists: [], items: [], members: [] };

// Mirrors lib/list/list-browsing.ts#browseLists' visibility rule exactly
// (settled in the same QnA session, question 10): Workspace Owner/Admin
// see every List; everyone else only Lists they're an explicit Member or
// Guest of.
function buildListVisibilityFilter(canSeeEveryList: boolean, userId: string): Prisma.ListWhereInput {
  return canSeeEveryList ? {} : { OR: [{ members: { some: { userId } } }, { guests: { some: { userId } } }] };
}

// Global Search for the header command palette (#56, #70): Lists, Items,
// and Members within one Workspace, permission-filtered the same way
// Lists browsing already is. Guests never call this — the header that
// opens the palette only renders inside the Workspace shell, which 404s
// without a WorkspaceMember row.
export async function globalSearch(
  database: PrismaClient,
  input: GlobalSearchInput
): Promise<GlobalSearchResult> {
  const { userId, workspaceId } = input;
  const query = input.query.trim();
  if (!query) {
    return EMPTY_RESULT;
  }

  const workspaceMembership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });
  // This membership check is the sole authorization gate for the whole
  // search (no Workspace shell renders a palette for a non-member) — a
  // Deleted Workspace must fail it too (#76).
  if (!workspaceMembership || isDeletedWorkspace(workspaceMembership.workspace)) {
    return EMPTY_RESULT;
  }

  const canSeeEveryList = workspaceMembership.role === "OWNER" || workspaceMembership.role === "ADMIN";
  const listVisibilityFilter = buildListVisibilityFilter(canSeeEveryList, userId);

  const [lists, items, members] = await Promise.all([
    database.list.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        name: { contains: query, mode: "insensitive" },
        ...listVisibilityFilter,
      },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_CATEGORY,
    }),
    database.item.findMany({
      where: {
        title: { contains: query, mode: "insensitive" },
        state: { not: "ARCHIVED" },
        list: { workspaceId, archivedAt: null, ...listVisibilityFilter },
      },
      select: { id: true, title: true, listId: true, list: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_CATEGORY,
    }),
    database.workspaceMember.findMany({
      where: { workspaceId, user: { name: { contains: query, mode: "insensitive" } } },
      select: { userId: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
      take: RESULTS_PER_CATEGORY,
    }),
  ]);

  return {
    lists: lists.map((list) => ({ id: list.id, name: list.name })),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      listId: item.listId,
      listName: item.list.name,
    })),
    members: members.map((member) => ({ userId: member.userId, name: member.user.name })),
  };
}
