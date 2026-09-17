import type { Item, ItemPriority, ItemState, PrismaClient, WorkspaceKind } from "@/generated/prisma/client";

export type MyTaskAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploaderName: string;
  createdAt: Date;
};

export type MyTaskItem = {
  id: string;
  title: string;
  state: ItemState;
  priority: ItemPriority;
  dueDate: Date | null;
  hasParent: boolean;
  listId: string;
  listName: string;
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  sourceWorkspaceKind: WorkspaceKind;
  // Shown in place of a due-date badge when state is BLOCKED
  // (design-mocks/my-tasks) — required at the application layer whenever
  // state is BLOCKED (lib/item/'s state-transition rules), so it's always
  // present for a Blocked Item.
  blockerReason: string | null;
  // Board's grouping is view-only for WORKSPACE (#43) and Files aggregates
  // across every assigned Item (#22-equivalent for My Tasks) — both views
  // read straight off this same fetch rather than issuing their own query.
  attachments: MyTaskAttachment[];
  // Dashboard's Completion-Over-Time widget (#46) uses this as the same
  // completion-timestamp approximation List Dashboard's does
  // (lib/report/list-dashboard.ts) — Item has no dedicated completedAt.
  updatedAt: Date;
};

// Shared by every My Tasks view (List row, Board card, Files entry) so the
// Personal Space label and an Item's link back to its source List read the
// same way everywhere rather than re-deriving them per view (#43).
export function myTaskWorkspaceLabel(source: {
  sourceWorkspaceKind: WorkspaceKind;
  sourceWorkspaceName: string;
}): string {
  return source.sourceWorkspaceKind === "PERSONAL" ? "Personal Space" : source.sourceWorkspaceName;
}

export function myTaskItemHref(source: { sourceWorkspaceId: string; listId: string }, itemId: string): string {
  return `/workspaces/${source.sourceWorkspaceId}/lists/${source.listId}/items/${itemId}`;
}

// Hidden from My Tasks unless explicitly requested via includeCompleted/
// includeArchived — every other state (including IN_PROGRESS) shows by
// default (#42).
const HIDDEN_BY_DEFAULT: readonly ItemState[] = ["COMPLETE", "ARCHIVED"];

export function isVisibleByDefault(state: ItemState): boolean {
  return !HIDDEN_BY_DEFAULT.includes(state);
}

export function isItemOverdue(item: { dueDate: Date | null }, now: Date): boolean {
  return item.dueDate !== null && item.dueDate.getTime() < now.getTime();
}

const PRIORITY_RANK: Record<ItemPriority, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };

// Default sort (#42): overdue Items first, then by Priority (High first),
// then by nearest due date — undated Items rank after every dated Item
// within the same overdue/Priority bucket via the Infinity fallback.
export function sortMyTasks<T extends { priority: ItemPriority; dueDate: Date | null }>(
  items: T[],
  now: Date
): T[] {
  const overdueRank = (item: T): number => (isItemOverdue(item, now) ? 0 : 1);
  const dueDateRank = (item: T): number => item.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;

  return [...items].sort(
    (a, b) =>
      overdueRank(a) - overdueRank(b) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      dueDateRank(a) - dueDateRank(b)
  );
}

function dueDateRank(item: { dueDate: Date | null }): number {
  return item.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
}

function sortMyTasksByDueDate<T extends { dueDate: Date | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => dueDateRank(a) - dueDateRank(b));
}

function sortMyTasksByPriority<T extends { priority: ItemPriority; dueDate: Date | null }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || dueDateRank(a) - dueDateRank(b)
  );
}

function sortMyTasksByTitle<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
}

export type MyTasksSortBy = "SMART" | "DUE_DATE" | "PRIORITY" | "TITLE";

// "Smart" is the #42 default order; the rest are the explicit Sort control
// this ticket (#44) adds on top of it (query-param-only, per #42's "not a
// persisted per-User preference" precedent — same rationale applies here).
const VALID_SORT_BY: readonly MyTasksSortBy[] = ["SMART", "DUE_DATE", "PRIORITY", "TITLE"];

export function isValidMyTasksSortBy(value: string): value is MyTasksSortBy {
  return (VALID_SORT_BY as readonly string[]).includes(value);
}

export function applyMyTasksSort<
  T extends { title: string; priority: ItemPriority; dueDate: Date | null },
>(items: T[], sortBy: MyTasksSortBy, now: Date): T[] {
  switch (sortBy) {
    case "DUE_DATE":
      return sortMyTasksByDueDate(items);
    case "PRIORITY":
      return sortMyTasksByPriority(items);
    case "TITLE":
      return sortMyTasksByTitle(items);
    case "SMART":
      return sortMyTasks(items, now);
  }
}

export type MyTasksGroupBy = "NONE" | "WORKSPACE" | "PRIORITY" | "DUE_DATE";

const VALID_GROUP_BY: readonly MyTasksGroupBy[] = ["NONE", "WORKSPACE", "PRIORITY", "DUE_DATE"];

export function isValidMyTasksGroupBy(value: string): value is MyTasksGroupBy {
  return (VALID_GROUP_BY as readonly string[]).includes(value);
}

export type MyTasksGroup<T> = { key: string; label: string; items: T[] };

const PRIORITY_LABEL: Record<ItemPriority, string> = { HIGH: "High", NORMAL: "Normal", LOW: "Low" };
const PRIORITY_GROUP_ORDER: readonly ItemPriority[] = ["HIGH", "NORMAL", "LOW"];

const DUE_DATE_GROUP_ORDER = ["OVERDUE", "TODAY", "UPCOMING", "NO_DUE_DATE"] as const;
type DueDateGroupKey = (typeof DUE_DATE_GROUP_ORDER)[number];
const DUE_DATE_GROUP_LABEL: Record<DueDateGroupKey, string> = {
  OVERDUE: "Overdue",
  TODAY: "Today",
  UPCOMING: "Upcoming",
  NO_DUE_DATE: "No due date",
};

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dueDateGroupKey(item: { dueDate: Date | null }, now: Date): DueDateGroupKey {
  if (item.dueDate === null) return "NO_DUE_DATE";
  if (isItemOverdue(item, now)) return "OVERDUE";
  if (isSameCalendarDay(item.dueDate, now)) return "TODAY";
  return "UPCOMING";
}

// Grouping is a client-facing arrangement of the already-filtered,
// already-sorted Item set (#44) — it never changes which Items are
// included, only how they're bucketed for display. "NONE" is represented
// as a single unlabeled group so callers always get a uniform shape.
export function groupMyTasksItems<
  T extends {
    priority: ItemPriority;
    dueDate: Date | null;
    sourceWorkspaceId: string;
    sourceWorkspaceName: string;
    sourceWorkspaceKind: WorkspaceKind;
  },
>(items: T[], groupBy: MyTasksGroupBy, now: Date): MyTasksGroup<T>[] {
  if (groupBy === "NONE") {
    return [{ key: "ALL", label: "", items }];
  }

  if (groupBy === "WORKSPACE") {
    const groups = new Map<string, MyTasksGroup<T>>();
    for (const item of items) {
      const label = item.sourceWorkspaceKind === "PERSONAL" ? "Personal Space" : item.sourceWorkspaceName;
      const group = groups.get(item.sourceWorkspaceId) ?? { key: item.sourceWorkspaceId, label, items: [] };
      group.items.push(item);
      groups.set(item.sourceWorkspaceId, group);
    }
    return [...groups.values()];
  }

  if (groupBy === "PRIORITY") {
    const byPriority = new Map<ItemPriority, T[]>();
    for (const item of items) {
      byPriority.set(item.priority, [...(byPriority.get(item.priority) ?? []), item]);
    }
    return PRIORITY_GROUP_ORDER.filter((priority) => byPriority.has(priority)).map((priority) => ({
      key: priority,
      label: PRIORITY_LABEL[priority],
      items: byPriority.get(priority) ?? [],
    }));
  }

  const byDueDateGroup = new Map<DueDateGroupKey, T[]>();
  for (const item of items) {
    const key = dueDateGroupKey(item, now);
    byDueDateGroup.set(key, [...(byDueDateGroup.get(key) ?? []), item]);
  }
  return DUE_DATE_GROUP_ORDER.filter((key) => byDueDateGroup.has(key)).map((key) => ({
    key,
    label: DUE_DATE_GROUP_LABEL[key],
    items: byDueDateGroup.get(key) ?? [],
  }));
}

export type MyTasksSmartSectionKey = "OVERDUE" | "BLOCKED" | "TODAY" | "UPCOMING" | "NO_DUE_DATE";

const SMART_SECTION_ORDER: readonly MyTasksSmartSectionKey[] = [
  "OVERDUE",
  "BLOCKED",
  "TODAY",
  "UPCOMING",
  "NO_DUE_DATE",
];
const SMART_SECTION_LABEL: Record<MyTasksSmartSectionKey, string> = {
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
  TODAY: "Today",
  UPCOMING: "Upcoming",
  NO_DUE_DATE: "No due date",
};

function smartSectionKey(item: { state: ItemState; dueDate: Date | null }, now: Date): MyTasksSmartSectionKey {
  if (item.state === "BLOCKED") return "BLOCKED";
  if (item.dueDate === null) return "NO_DUE_DATE";
  if (isItemOverdue(item, now)) return "OVERDUE";
  if (isSameCalendarDay(item.dueDate, now)) return "TODAY";
  return "UPCOMING";
}

// The mock's default grouping (design-mocks/my-tasks): a State-aware
// refinement of the #42 SMART sort into labeled sections rather than a new
// selectable Group-by field — Blocked is its own section regardless of due
// date (it needs different handling from the User than a date alone
// implies), everything else buckets by due date exactly like the explicit
// Due Date group-by. Presentational only: it never changes which Items are
// included or their SMART order within a section, and callers only use it
// in place of groupMyTasksItems() while groupBy is "NONE" (no explicit
// Group-by field chosen).
export function buildMyTasksSmartSections<
  T extends { state: ItemState; priority: ItemPriority; dueDate: Date | null },
>(items: T[], now: Date): MyTasksGroup<T>[] {
  const bySection = new Map<MyTasksSmartSectionKey, T[]>();
  for (const item of items) {
    const key = smartSectionKey(item, now);
    bySection.set(key, [...(bySection.get(key) ?? []), item]);
  }
  return SMART_SECTION_ORDER.filter((key) => bySection.has(key)).map((key) => ({
    key,
    label: SMART_SECTION_LABEL[key],
    items: bySection.get(key) ?? [],
  }));
}

export type ListBreakdownEntry = { listId: string; label: string; count: number };

// Dashboard's cross-Workspace analog of List Dashboard's Breakdown by
// Section (#46) — My Tasks spans every List across every Workspace a User
// belongs to rather than one List's Sections, so it groups by source List
// instead of Section. Ordered by count descending so the busiest List
// reads first.
export function breakdownByList<T extends { listId: string; listName: string }>(items: T[]): ListBreakdownEntry[] {
  const entriesByListId = new Map<string, ListBreakdownEntry>();
  for (const item of items) {
    const existing = entriesByListId.get(item.listId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    entriesByListId.set(item.listId, { listId: item.listId, label: item.listName, count: 1 });
  }

  return [...entriesByListId.values()].sort((a, b) => b.count - a.count);
}

export type MyTaskBadgeTone = "red" | "amber" | "green" | "blue" | "muted";
export type MyTaskBadge = { tone: MyTaskBadgeTone; label: string };

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The due/status badge shown per row (design-mocks/my-tasks): Blocked
// state takes priority over any date (mirrors smartSectionKey's
// precedence), then Complete, then the date itself — "Today" reads better
// than a formatted date a User already knows is today.
export function myTaskRowBadge(
  item: { state: ItemState; dueDate: Date | null; blockerReason: string | null },
  now: Date
): MyTaskBadge {
  if (item.state === "BLOCKED") return { tone: "amber", label: item.blockerReason ?? "Blocked" };
  if (item.state === "COMPLETE") return { tone: "green", label: "Complete" };
  if (item.dueDate === null) return { tone: "muted", label: "Undated" };
  if (isItemOverdue(item, now)) return { tone: "red", label: formatShortDate(item.dueDate) };
  if (isSameCalendarDay(item.dueDate, now)) return { tone: "blue", label: "Today" };
  return { tone: "blue", label: formatShortDate(item.dueDate) };
}

function toMyTaskItem(
  item: Item & {
    list: { id: string; name: string; workspaceId: string; workspace: { id: string; name: string; kind: WorkspaceKind } };
    attachments: { id: string; fileName: string; sizeBytes: number; createdAt: Date; uploader: { name: string } }[];
  }
): MyTaskItem {
  return {
    id: item.id,
    title: item.title,
    state: item.state,
    priority: item.priority,
    dueDate: item.dueDate,
    hasParent: item.parentId !== null,
    listId: item.list.id,
    listName: item.list.name,
    sourceWorkspaceId: item.list.workspace.id,
    sourceWorkspaceName: item.list.workspace.name,
    sourceWorkspaceKind: item.list.workspace.kind,
    blockerReason: item.blockerReason,
    attachments: item.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      sizeBytes: attachment.sizeBytes,
      uploaderName: attachment.uploader.name,
      createdAt: attachment.createdAt,
    })),
    updatedAt: item.updatedAt,
  };
}

// Unifies Items assigned to a User across every Workspace they belong to
// plus their Personal Space (CONTEXT.md My Tasks) — reads the same Item
// rows shown elsewhere via ItemAssignee, never a separate copy (#42).
export async function loadMyTasksItems(
  database: PrismaClient,
  input: {
    userId: string;
    sourceWorkspaceId?: string;
    includeCompleted?: boolean;
    includeArchived?: boolean;
    search?: string;
    sortBy?: MyTasksSortBy;
    now?: Date;
  }
): Promise<MyTaskItem[]> {
  const {
    userId,
    sourceWorkspaceId,
    includeCompleted = false,
    includeArchived = false,
    search,
    sortBy = "SMART",
    now = new Date(),
  } = input;

  const assignments = await database.itemAssignee.findMany({
    where: {
      userId,
      item: {
        ...(sourceWorkspaceId ? { list: { workspaceId: sourceWorkspaceId } } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      },
    },
    include: {
      item: {
        include: {
          list: { include: { workspace: true } },
          attachments: { include: { uploader: { select: { name: true } } } },
        },
      },
    },
  });

  const visibleItems = assignments
    .map((assignment) => assignment.item)
    .filter((item) => {
      if (item.state === "COMPLETE") return includeCompleted;
      if (item.state === "ARCHIVED") return includeArchived;
      return true;
    });

  return applyMyTasksSort(visibleItems.map(toMyTaskItem), sortBy, now);
}
