import type { PrismaClient } from "@/generated/prisma/client";
import {
  breakdownByList,
  buildMyTasksSmartSections,
  groupMyTasksItems,
  loadMyTasksItems,
  type ListBreakdownEntry,
  type MyTaskItem,
  type MyTasksGroup,
  type MyTasksGroupBy,
  type MyTasksSortBy,
} from "@/lib/item/item-my-tasks";
import {
  groupMyTasksForBoard,
  isValidMyTasksBoardGroupBy,
  type MyTasksBoardColumn,
  type MyTasksBoardGroupBy,
} from "@/lib/item/item-my-tasks-board";
import {
  buildMyTasksCalendarGrid,
  formatCalendarMonthParam,
  parseCalendarMonth,
  type MyTasksCalendarCell,
} from "@/lib/item/item-my-tasks-calendar";
import { buildMyTasksFileEntries, type MyTasksFileEntry } from "@/lib/item/item-my-tasks-files";
import {
  breakdownByState,
  buildCompletionOverTime,
  buildPersonalAttentionImbalance,
  buildPersonalContributionByList,
  computeItemCounts,
  computeProgressPercent,
  type CompletionOverTimePoint,
  type ItemCounts,
  type ListContributionEntry,
  type PersonalAttentionImbalance,
  type StateBreakdownEntry,
} from "@/lib/report/list-dashboard";

export type MyTasksFilterWorkspace = { id: string; name: string; isPersonal: boolean };

// Same window as List Dashboard's Completion Over Time widget
// (app/workspaces/.../page-data.ts) so the two surfaces read consistently.
const COMPLETION_OVER_TIME_DAYS = 14;

// Dashboard tab (#46, #49, #50, #51) — a trimmed personal Dashboard: counts,
// breakdowns, Completion-Over-Time, the Progress graph, a personal
// Contribution Map, and the personal Attention Imbalance radar
// (design-mocks/my-tasks-dashboard). Unlike List/Board/Calendar/Files,
// which respect the includeCompleted/includeArchived toggles so a User can
// hide clutter from their working view, the Dashboard's own metrics are
// inherently about completed work (completion rate, progress-toward-done,
// completion trend) and would always read as zero if they stayed scoped to
// those toggles' default-hidden state — so Dashboard data is computed from
// its own always-includeCompleted fetch below, matching how List
// Dashboard's page-data.ts always sees a List's Complete Items regardless
// of the List view's own filters. No heatmap/peer-comparison — those are
// List Dashboard-specific or still-open widgets.
export type MyTasksDashboardData = {
  counts: ItemCounts;
  byState: StateBreakdownEntry[];
  byList: ListBreakdownEntry[];
  completionOverTime: CompletionOverTimePoint[];
  progressPercent: number;
  contributionByList: ListContributionEntry[];
  attentionImbalance: PersonalAttentionImbalance;
};

export type MyTasksPageData = {
  groups: MyTasksGroup<MyTaskItem>[];
  filterWorkspaces: MyTasksFilterWorkspace[];
  selectedWorkspaceId: string | null;
  includeCompleted: boolean;
  includeArchived: boolean;
  search: string;
  sortBy: MyTasksSortBy;
  groupBy: MyTasksGroupBy;
  // Board/Calendar/Files/Dashboard (#43, #52) — computed here, not in
  // page.tsx, matching the List page-data.ts convention so a Server
  // Component smoke test can assert on the same data the views render
  // without touching JSX.
  boardGroupBy: MyTasksBoardGroupBy;
  boardColumns: MyTasksBoardColumn[];
  calendarMonth: string;
  calendarCells: MyTasksCalendarCell[];
  fileEntries: MyTasksFileEntry[];
  dashboard: MyTasksDashboardData;
};

// Kept separate from the page component (same rationale as the List page's
// page-data.ts): a real Next.js request scope isn't available under plain
// tsx, so session lookup stays in page.tsx while everything testable lives
// here on an injected PrismaClient.
export async function loadMyTasksPageData(
  database: PrismaClient,
  input: {
    userId: string;
    sourceWorkspaceId?: string;
    includeCompleted?: boolean;
    includeArchived?: boolean;
    search?: string;
    sortBy?: MyTasksSortBy;
    groupBy?: MyTasksGroupBy;
    now?: Date;
    boardGroupBy?: string;
    calendarMonth?: string;
  }
): Promise<MyTasksPageData> {
  const {
    userId,
    sourceWorkspaceId,
    includeCompleted = false,
    includeArchived = false,
    search = "",
    sortBy = "SMART",
    groupBy = "NONE",
    now = new Date(),
    boardGroupBy: rawBoardGroupBy,
    calendarMonth: rawCalendarMonth,
  } = input;

  const [items, dashboardItems, memberships] = await Promise.all([
    loadMyTasksItems(database, {
      userId,
      sourceWorkspaceId,
      includeCompleted,
      includeArchived,
      search: search || undefined,
      sortBy,
      now,
    }),
    // Always includeCompleted, never includeArchived or search-filtered —
    // see the MyTasksDashboardData comment above for why the Dashboard
    // can't reuse the toggle-filtered `items` above.
    loadMyTasksItems(database, { userId, sourceWorkspaceId, includeCompleted: true, now }),
    database.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const boardGroupBy: MyTasksBoardGroupBy =
    rawBoardGroupBy && isValidMyTasksBoardGroupBy(rawBoardGroupBy) ? rawBoardGroupBy : "STATE";
  const calendarMonthStart = parseCalendarMonth(rawCalendarMonth, now);
  const dashboardCounts = computeItemCounts(dashboardItems, now);

  return {
    // groupBy "NONE" (the default) renders the mock's smart sections
    // (Overdue/Blocked/Today/Upcoming/No due date) rather than one flat
    // "ALL" bucket — an explicit Group-by field still wins when chosen.
    groups: groupBy === "NONE" ? buildMyTasksSmartSections(items, now) : groupMyTasksItems(items, groupBy, now),
    filterWorkspaces: memberships.map((membership) => ({
      id: membership.workspaceId,
      name: membership.workspace.name,
      isPersonal: membership.workspace.kind === "PERSONAL",
    })),
    selectedWorkspaceId: sourceWorkspaceId ?? null,
    includeCompleted,
    includeArchived,
    search,
    sortBy,
    groupBy,
    boardGroupBy,
    boardColumns: groupMyTasksForBoard(items, boardGroupBy),
    calendarMonth: formatCalendarMonthParam(calendarMonthStart),
    calendarCells: buildMyTasksCalendarGrid(items, calendarMonthStart),
    fileEntries: buildMyTasksFileEntries(items),
    dashboard: {
      counts: dashboardCounts,
      byState: breakdownByState(dashboardItems),
      byList: breakdownByList(dashboardItems),
      completionOverTime: buildCompletionOverTime(dashboardItems, now, COMPLETION_OVER_TIME_DAYS),
      progressPercent: computeProgressPercent(dashboardCounts),
      contributionByList: buildPersonalContributionByList(dashboardItems),
      attentionImbalance: buildPersonalAttentionImbalance(dashboardItems, now),
    },
  };
}
