import type { PrismaClient } from "@/generated/prisma/client";
import { type AssignedByMeItem, loadAssignedByMeItems } from "@/lib/item/item-assigned-by-me";
import { loadMyTasksItems, type MyTaskItem } from "@/lib/item/item-my-tasks";
import { browseLists, type ListSummary } from "@/lib/list/list-browsing";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";

const WIDGET_PREVIEW_LIMIT = 5;

// Recent Lists shows "N items · X% complete" (Home's mock), a stat no
// other List consumer needs — kept local here rather than added to the
// shared ListSummary/browseLists contract in lib/list/list-browsing.ts.
export type RecentListSummary = ListSummary & { itemCount: number; completionPercent: number };

export type HomePageData = {
  workspaceName: string;
  myTasksPreview: MyTaskItem[];
  recentLists: RecentListSummary[];
  assignedByMe: AssignedByMeItem[];
  unreadNotificationCount: number;
};

async function withItemStats(
  database: PrismaClient,
  lists: ListSummary[]
): Promise<RecentListSummary[]> {
  if (lists.length === 0) return [];

  const counts = await database.item.groupBy({
    by: ["listId", "state"],
    where: { listId: { in: lists.map((list) => list.id) } },
    _count: { _all: true },
  });

  return lists.map((list) => {
    const listCounts = counts.filter((count) => count.listId === list.id);
    const itemCount = listCounts.reduce((sum, count) => sum + count._count._all, 0);
    const completedCount = listCounts
      .filter((count) => count.state === "COMPLETE")
      .reduce((sum, count) => sum + count._count._all, 0);

    return {
      ...list,
      itemCount,
      completionPercent: itemCount === 0 ? 0 : Math.round((completedCount / itemCount) * 100),
    };
  });
}

// Kept separate from the page component (same rationale as My Tasks' and
// the List page's page-data.ts): session lookup stays in page.tsx, while
// everything testable lives here on an injected PrismaClient.
export async function loadHomePageData(
  database: PrismaClient,
  input: { userId: string; workspaceId: string; now?: Date }
): Promise<HomePageData | null> {
  const { userId, workspaceId, now } = input;

  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });

  if (!membership) {
    return null;
  }

  // Recent Lists orders by the List's own updatedAt (browseLists' existing
  // sort), not per-user visit recency — the domain model has no List-visit
  // tracking to draw on (docs/QnA/listitup-profile-and-home-surface.md §6).
  const [myTasksItems, recentLists, assignedByMe, unreadNotificationCount] = await Promise.all([
    loadMyTasksItems(database, { userId, sourceWorkspaceId: workspaceId, now }),
    browseLists(database, { userId, workspaceId }),
    loadAssignedByMeItems(database, { userId, workspaceId, limit: WIDGET_PREVIEW_LIMIT }),
    countUnreadNotifications(database, userId),
  ]);

  return {
    workspaceName: membership.workspace.name,
    myTasksPreview: myTasksItems.slice(0, WIDGET_PREVIEW_LIMIT),
    recentLists: await withItemStats(database, recentLists.slice(0, WIDGET_PREVIEW_LIMIT)),
    assignedByMe,
    unreadNotificationCount,
  };
}
