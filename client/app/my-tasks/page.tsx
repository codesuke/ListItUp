import {
  BarChart3,
  Calendar as CalendarIcon,
  Columns3,
  List as ListIcon,
  Paperclip,
} from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { DismissOpenDisclosures } from "@/components/workspace/DismissOpenDisclosures";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { FilterToggleLink, OptionsDisclosure } from "@/components/workspace/OptionsDisclosure";
import { addCalendarMonths, formatCalendarMonthParam, parseCalendarMonth } from "@/lib/item/item-my-tasks-calendar";
import type { MyTasksBoardGroupBy } from "@/lib/item/item-my-tasks-board";
import {
  isItemOverdue,
  isValidMyTasksGroupBy,
  isValidMyTasksSortBy,
  type MyTasksGroupBy,
  type MyTasksSortBy,
} from "@/lib/item/item-my-tasks";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { completeMyTaskItemAction, moveMyTaskItemAction, quickAddItemAction } from "./actions";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import { DashboardView } from "./DashboardView";
import { FilesView } from "./FilesView";
import { MyTasksList } from "./MyTasksList";
import { loadMyTasksPageData, type MyTasksFilterWorkspace } from "./page-data";
import { QuickAddForm } from "./QuickAddForm";
import { SearchForm } from "./SearchForm";

type Query = {
  workspace?: string;
  completed?: string;
  archived?: string;
  tab?: string;
  groupBy?: string;
  month?: string;
  q?: string;
  sort?: string;
  group?: string;
};

type Props = {
  searchParams: Promise<Query>;
};

type TabKey = "list" | "board" | "calendar" | "files" | "dashboard";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "list", label: "List", icon: ListIcon },
  { key: "board", label: "Board", icon: Columns3 },
  { key: "calendar", label: "Calendar", icon: CalendarIcon },
  { key: "files", label: "Files", icon: Paperclip },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
];

const BOARD_GROUP_BY_OPTIONS: { key: MyTasksBoardGroupBy; label: string }[] = [
  { key: "STATE", label: "State" },
  { key: "PRIORITY", label: "Priority" },
  { key: "WORKSPACE", label: "Workspace" },
];

const TAB_KEYS: readonly string[] = TABS.map((tab) => tab.key);

function isTabKey(value: string): value is TabKey {
  return TAB_KEYS.includes(value);
}

function myTasksHref(query: Query): string {
  const params = new URLSearchParams();
  if (query.workspace) params.set("workspace", query.workspace);
  if (query.completed) params.set("completed", query.completed);
  if (query.archived) params.set("archived", query.archived);
  if (query.tab && query.tab !== "list") params.set("tab", query.tab);
  if (query.groupBy) params.set("groupBy", query.groupBy);
  if (query.month) params.set("month", query.month);
  if (query.q) params.set("q", query.q);
  if (query.sort) params.set("sort", query.sort);
  if (query.group) params.set("group", query.group);
  const search = params.toString();
  return search ? `/my-tasks?${search}` : "/my-tasks";
}

const SORT_OPTIONS: { value: MyTasksSortBy; label: string }[] = [
  { value: "SMART", label: "Smart" },
  { value: "DUE_DATE", label: "Due date" },
  { value: "PRIORITY", label: "Priority" },
  { value: "TITLE", label: "Title" },
];

const GROUP_OPTIONS: { value: MyTasksGroupBy; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "WORKSPACE", label: "Workspace" },
  { value: "PRIORITY", label: "Priority" },
  { value: "DUE_DATE", label: "Due date" },
];

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// The Workspace the sidebar/topbar shell renders as "current": the
// explicitly filtered one if valid, else the same oldest-SHARED-else-
// Personal-Space choice as the root landing page
// (lib/workspace/default-workspace.ts) — My Tasks is cross-Workspace, so
// there's no URL segment to source this from the way /workspaces/[id]
// pages do.
function resolveShellWorkspace(
  filterWorkspaces: MyTasksFilterWorkspace[],
  selectedWorkspaceId: string | null
): MyTasksFilterWorkspace | null {
  const selected = filterWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  if (selected) return selected;
  return filterWorkspaces.find((workspace) => !workspace.isPersonal) ?? filterWorkspaces[0] ?? null;
}

export default async function MyTasksPage({ searchParams }: Props) {
  const session = await requireAuthenticatedSession("/my-tasks");
  const query = await searchParams;

  const sourceWorkspaceId = query.workspace || undefined;
  const includeCompleted = query.completed === "1";
  const includeArchived = query.archived === "1";
  const search = query.q?.trim() ?? "";
  const sortBy = query.sort && isValidMyTasksSortBy(query.sort) ? query.sort : "SMART";
  const groupBy = query.group && isValidMyTasksGroupBy(query.group) ? query.group : "NONE";
  const now = new Date();
  const activeTab: TabKey = query.tab && isTabKey(query.tab) ? query.tab : "list";

  const [data, unreadNotificationCount] = await Promise.all([
    loadMyTasksPageData(prisma, {
      userId: session.user.id,
      sourceWorkspaceId,
      includeCompleted,
      includeArchived,
      search,
      sortBy,
      groupBy,
      now,
      boardGroupBy: query.groupBy,
      calendarMonth: query.month,
    }),
    countUnreadNotifications(prisma, session.user.id),
  ]);

  const shellWorkspace = resolveShellWorkspace(data.filterWorkspaces, data.selectedWorkspaceId);
  if (!shellWorkspace) {
    notFound();
  }

  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL must be set.");
  const boundComplete = (itemId: string) => completeMyTaskItemAction.bind(null, itemId);
  const boundMoveItem = moveMyTaskItemAction.bind(null, data.boardGroupBy);

  const calendarMonthStart = parseCalendarMonth(query.month, now);
  const monthLabel = calendarMonthStart.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prevMonthHref = myTasksHref({
    ...query,
    tab: "calendar",
    month: formatCalendarMonthParam(addCalendarMonths(calendarMonthStart, -1)),
  });
  const nextMonthHref = myTasksHref({
    ...query,
    tab: "calendar",
    month: formatCalendarMonthParam(addCalendarMonths(calendarMonthStart, 1)),
  });

  const selectedWorkspace = data.filterWorkspaces.find((workspace) => workspace.id === data.selectedWorkspaceId);
  const workspaceScopeLabel = selectedWorkspace
    ? selectedWorkspace.isPersonal
      ? "Personal Space"
      : selectedWorkspace.name
    : "All Workspaces";
  const workspaceOptions = [
    { key: "", label: "All Workspaces", href: myTasksHref({ ...query, workspace: undefined }), active: !data.selectedWorkspaceId },
    ...data.filterWorkspaces.map((workspace) => ({
      key: workspace.id,
      label: workspace.isPersonal ? "Personal Space" : workspace.name,
      href: myTasksHref({ ...query, workspace: workspace.id }),
      active: data.selectedWorkspaceId === workspace.id,
    })),
  ];
  const sortOptions = SORT_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    href: myTasksHref({ ...query, sort: option.value }),
    active: sortBy === option.value,
  }));
  const groupOptions = GROUP_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    href: myTasksHref({ ...query, group: option.value }),
    active: groupBy === option.value,
  }));
  const boardGroupOptions = BOARD_GROUP_BY_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    href: myTasksHref({ ...query, tab: "board", groupBy: option.key }),
    active: data.boardGroupBy === option.key,
  }));

  // An at-a-glance line, not a dashboard card — "how many of these need me
  // right now" before a User reads a single row title. Derived from the
  // already-filtered, already-grouped set (flattening never drops or
  // duplicates an Item — see page.smoke.test.tsx) rather than from its own
  // query, so it always matches what's actually on screen below it.
  const flatItems = data.groups.flatMap((group) => group.items);
  const overdueCount = flatItems.filter((item) => isItemOverdue(item, now)).length;
  const dueTodayCount = flatItems.filter(
    (item) => item.dueDate !== null && !isItemOverdue(item, now) && isSameCalendarDay(item.dueDate, now)
  ).length;

  return (
    <AppShell
      currentWorkspaceId={shellWorkspace.id}
      currentWorkspaceName={shellWorkspace.isPersonal ? "Personal Space" : shellWorkspace.name}
      userId={session.user.id}
    >
      <div className="flex min-h-screen flex-col animate-in fade-in duration-200">
        <DismissOpenDisclosures />
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
          <h1 className="text-[13px] font-semibold text-ink">My Tasks</h1>
          <GlobalHeaderActions
            currentUserName={session.user.name}
            unreadNotificationCount={unreadNotificationCount}
            workspaceId={shellWorkspace.id}
          />
        </header>

        <main className="flex-1 bg-canvas px-10 pb-16 pt-8">
          <div className="mx-auto max-w-6xl">
            <nav className="mb-6 flex flex-wrap items-center gap-6 border-b border-line">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <a
                    key={tab.key}
                    href={myTasksHref({ ...query, tab: tab.key === "list" ? undefined : tab.key })}
                    className={
                      activeTab === tab.key
                        ? "flex items-center gap-1.5 border-b-2 border-[#ff6b4a] py-3 text-[13.5px] font-semibold text-ink"
                        : "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" /> {tab.label}
                  </a>
                );
              })}
            </nav>

            <QuickAddForm quickAddItemAction={quickAddItemAction} mentionCandidates={data.mentionCandidates} />

            {activeTab === "list" ? (
              <>
                <p className="mb-5 text-[13px] text-ink-muted">
                  <span className="font-semibold text-ink">{flatItems.length}</span>{" "}
                  {flatItems.length === 1 ? "task" : "tasks"} ·{" "}
                  <span
                    className={overdueCount > 0 ? "font-medium text-[color:var(--accent-attention)]" : undefined}
                  >
                    {overdueCount} overdue
                  </span>{" "}
                  · {dueTodayCount} due today
                </p>

                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <OptionsDisclosure label="Workspace" currentLabel={workspaceScopeLabel} options={workspaceOptions} />
                    <FilterToggleLink
                      href={myTasksHref({ ...query, completed: includeCompleted ? undefined : "1" })}
                      active={includeCompleted}
                      label="Completed"
                    />
                    <FilterToggleLink
                      href={myTasksHref({ ...query, archived: includeArchived ? undefined : "1" })}
                      active={includeArchived}
                      label="Archived"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <SearchForm
                      workspace={query.workspace ?? ""}
                      completed={query.completed ?? ""}
                      archived={query.archived ?? ""}
                      sort={sortBy}
                      group={groupBy}
                      search={search}
                    />
                    <OptionsDisclosure
                      label="Sort"
                      currentLabel={SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? "Smart"}
                      options={sortOptions}
                    />
                    <OptionsDisclosure
                      label="Group"
                      currentLabel={GROUP_OPTIONS.find((option) => option.value === groupBy)?.label ?? "None"}
                      options={groupOptions}
                    />
                  </div>
                </div>

                <MyTasksList groups={data.groups} now={now} baseUrl={baseUrl} boundComplete={boundComplete} />

                {!includeCompleted && !includeArchived && (
                  <p className="mt-4 text-[12px] text-ink-muted">
                    Complete and Archived tasks are hidden by default — use Completed / Archived above to show them.
                  </p>
                )}
              </>
            ) : activeTab === "board" ? (
              <>
                <div className="mb-5 flex items-center gap-1 border-b border-line pb-3">
                  <OptionsDisclosure
                    label="Group by"
                    currentLabel={BOARD_GROUP_BY_OPTIONS.find((option) => option.key === data.boardGroupBy)?.label ?? "State"}
                    options={boardGroupOptions}
                  />
                </div>
                <BoardView columns={data.boardColumns} groupBy={data.boardGroupBy} boundMoveItem={boundMoveItem} />
              </>
            ) : activeTab === "calendar" ? (
              <CalendarView
                cells={data.calendarCells}
                monthLabel={monthLabel}
                prevHref={prevMonthHref}
                nextHref={nextMonthHref}
              />
            ) : activeTab === "files" ? (
              <FilesView entries={data.fileEntries} />
            ) : (
              <DashboardView {...data.dashboard} />
            )}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
