import type { PrismaClient } from "@/generated/prisma/client";
import { type AssignedByMeItem, loadAssignedByMeItems } from "@/lib/item/item-assigned-by-me";
import {
  buildMyTasksSmartSections,
  loadMyTasksItems,
  type MyTaskItem,
  type MyTasksGroup,
  type MyTasksSmartSectionKey,
} from "@/lib/item/item-my-tasks";
import { browseLists, type ListSummary } from "@/lib/list/list-browsing";
import { type ActivityNotification, countUnreadNotifications, loadActivityNotifications } from "@/lib/notification/notification-inbox";

const LIST_PREVIEW_LIMIT = 5;
const TASKS_PREVIEW_LIMIT = 8;
const ACTIVITY_PREVIEW_LIMIT = 6;

// The sections worth surfacing as an at-a-glance count next to the "My
// Tasks" heading — Upcoming/No due date aren't urgent enough to earn a
// glance-line mention (the user doesn't need to act on those today).
const ATTENTION_SECTION_KEYS: readonly MyTasksSmartSectionKey[] = ["OVERDUE", "BLOCKED", "TODAY"];

// Recent Lists shows "N items · X% complete" (Home's mock), a stat no
// other List consumer needs — kept local here rather than added to the
// shared ListSummary/browseLists contract in lib/list/list-browsing.ts.
export type RecentListSummary = ListSummary & { itemCount: number; completionPercent: number };

export type MyTasksAttentionCount = { key: MyTasksSmartSectionKey; label: string; count: number };

export type HomePageData = {
  workspaceName: string;
  myTasksSections: MyTasksGroup<MyTaskItem>[];
  myTasksTotalCount: number;
  myTasksAttentionCounts: MyTasksAttentionCount[];
  recentLists: RecentListSummary[];
  assignedByMe: AssignedByMeItem[];
  recentActivity: ActivityNotification[];
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
  const { userId, workspaceId, now = new Date() } = input;

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
  const [myTasksItems, recentLists, assignedByMe, recentActivity, unreadNotificationCount] = await Promise.all([
    loadMyTasksItems(database, { userId, sourceWorkspaceId: workspaceId, now }),
    browseLists(database, { userId, workspaceId }),
    loadAssignedByMeItems(database, { userId, workspaceId, limit: LIST_PREVIEW_LIMIT }),
    loadActivityNotifications(database, { recipientId: userId }),
    countUnreadNotifications(database, userId),
  ]);

  // myTasksItems is already SMART-sorted (overdue first, then priority,
  // then due date — lib/item/item-my-tasks.ts), so slicing before grouping
  // keeps the most urgent items in the preview without re-deriving order.
  const myTasksAttentionCounts = buildMyTasksSmartSections(myTasksItems, now)
    .filter((group) => ATTENTION_SECTION_KEYS.includes(group.key as MyTasksSmartSectionKey))
    .map((group) => ({ key: group.key as MyTasksSmartSectionKey, label: group.label, count: group.items.length }));

  return {
    workspaceName: membership.workspace.name,
    myTasksSections: buildMyTasksSmartSections(myTasksItems.slice(0, TASKS_PREVIEW_LIMIT), now),
    myTasksTotalCount: myTasksItems.length,
    myTasksAttentionCounts,
    recentLists: await withItemStats(database, recentLists.slice(0, LIST_PREVIEW_LIMIT)),
    assignedByMe,
    recentActivity: recentActivity.slice(0, ACTIVITY_PREVIEW_LIMIT),
    unreadNotificationCount,
  };
}
