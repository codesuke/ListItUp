import {
  BarChart3,
  Bell,
  Calendar as CalendarIcon,
  Columns3,
  Filter,
  List as ListIcon,
  Paperclip,
  Search,
} from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { addCalendarMonths, formatCalendarMonthParam, parseCalendarMonth } from "@/lib/item/item-my-tasks-calendar";
import type { MyTasksBoardGroupBy } from "@/lib/item/item-my-tasks-board";
import {
  isValidMyTasksGroupBy,
  isValidMyTasksSortBy,
  type MyTasksGroupBy,
  type MyTasksSortBy,
} from "@/lib/item/item-my-tasks";
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

// Dashboard is this spec's deliberately reserved placeholder — its content
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

const CHIP_BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 font-[family-name:var(--font-mono-label)] text-[10.5px] tracking-[0.04em]";
const CHIP_ACTIVE = `${CHIP_BASE} border-[#ff6b4a] bg-[#ff6b4a24] text-[#ff8a70]`;
const CHIP_INACTIVE = `${CHIP_BASE} border-[#333333] bg-[#1a1a1a] text-[#8f8f8a] hover:text-[#e5e5e0]`;

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

  const data = await loadMyTasksPageData(prisma, {
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
  });

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
  const scopeBadgeLabel = selectedWorkspace
    ? selectedWorkspace.isPersonal
      ? "Personal Space"
      : selectedWorkspace.name
    : "Across all Workspaces";

  return (
    <AppShell
      currentWorkspaceId={shellWorkspace.id}
      currentWorkspaceName={shellWorkspace.isPersonal ? "Personal Space" : shellWorkspace.name}
      currentUserName={session.user.name}
      userId={session.user.id}
    >
      <div className="flex min-h-screen flex-col">
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-[#232323] bg-[#0d0d0d] px-7">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#e5e5e0]">My Tasks</span>
            <span className="whitespace-nowrap rounded-[5px] bg-[#202020] px-[7px] py-[2px] font-[family-name:var(--font-mono-label)] text-[10px] font-semibold tracking-[0.05em] text-[#8f8f8a]">
              {scopeBadgeLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Search"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-[#333333] bg-[#141414] text-[#8f8f8a] hover:bg-[#1a1a1a] hover:text-[#e5e5e0]"
            >
              <Search className="h-[15px] w-[15px]" />
            </button>
            <a
              href="/updates"
              aria-label="Updates"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-[#333333] bg-[#141414] text-[#8f8f8a] hover:bg-[#1a1a1a] hover:text-[#e5e5e0]"
            >
              <Bell className="h-[15px] w-[15px]" />
            </a>
          </div>
        </header>

        <main className="flex-1 bg-[#080808] px-10 pb-16 pt-8">
          <div className="mx-auto max-w-6xl">
            <nav className="mb-5 flex flex-wrap items-center gap-6 border-b border-[#232323]">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <a
                    key={tab.key}
                    href={myTasksHref({ ...query, tab: tab.key === "list" ? undefined : tab.key })}
                    className={
                      activeTab === tab.key
                        ? "flex items-center gap-1.5 border-b-2 border-[#ff6b4a] py-3 text-[13px] font-semibold text-[#e5e5e0]"
                        : "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-semibold text-[#8f8f8a] hover:text-[#e5e5e0]"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" /> {tab.label}
                  </a>
                );
              })}
            </nav>

            <QuickAddForm quickAddItemAction={quickAddItemAction} />

            {activeTab === "list" ? (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={myTasksHref({ ...query, completed: includeCompleted ? undefined : "1" })}
                      className={includeCompleted ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      <Filter className="h-3 w-3" /> Completed
                    </a>
                    <a
                      href={myTasksHref({ ...query, archived: includeArchived ? undefined : "1" })}
                      className={includeArchived ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      Archived
                    </a>
                    <a
                      href={myTasksHref({ ...query, workspace: undefined })}
                      className={!data.selectedWorkspaceId ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      All Workspaces
                    </a>
                    {data.filterWorkspaces.map((workspace) => (
                      <a
                        key={workspace.id}
                        href={myTasksHref({ ...query, workspace: workspace.id })}
                        className={data.selectedWorkspaceId === workspace.id ? CHIP_ACTIVE : CHIP_INACTIVE}
                      >
                        {workspace.isPersonal ? "Personal Space" : workspace.name}
                      </a>
                    ))}
                  </div>
                  <form action="/my-tasks" method="GET" className="flex items-center gap-2">
                    <input type="hidden" name="workspace" value={query.workspace ?? ""} />
                    <input type="hidden" name="completed" value={query.completed ?? ""} />
                    <input type="hidden" name="archived" value={query.archived ?? ""} />
                    <input type="hidden" name="sort" value={sortBy} />
                    <input type="hidden" name="group" value={groupBy} />
                    <div className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#333333] bg-[#141414] px-2.5">
                      <Search className="h-3.5 w-3.5 flex-shrink-0 text-[#5a5a56]" />
                      <input
                        type="search"
                        name="q"
                        defaultValue={search}
                        aria-label="Search your Items"
                        placeholder="Search…"
                        className="w-32 bg-transparent text-[12.5px] text-[#e5e5e0] outline-none placeholder:text-[#5a5a56]"
                      />
                    </div>
                  </form>
                </div>

                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.08em] text-[#5a5a56]">
                    Sort:
                  </span>
                  {SORT_OPTIONS.map((option) => (
                    <a
                      key={option.value}
                      href={myTasksHref({ ...query, sort: option.value })}
                      className={sortBy === option.value ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      {option.label}
                    </a>
                  ))}
                  <span className="ml-2 font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.08em] text-[#5a5a56]">
                    Group:
                  </span>
                  {GROUP_OPTIONS.map((option) => (
                    <a
                      key={option.value}
                      href={myTasksHref({ ...query, group: option.value })}
                      className={groupBy === option.value ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      {option.label}
                    </a>
                  ))}
                </div>

                <MyTasksList
                  groups={data.groups}
                  now={now}
                  baseUrl={baseUrl}
                  viewerName={session.user.name}
                  boundComplete={boundComplete}
                />

                {!includeCompleted && !includeArchived && (
                  <p className="mt-3 text-[11.5px] text-[#5a5a56]">
                    Complete and Archived items are hidden by default — use the filter chips above to reveal them.
                  </p>
                )}
              </>
            ) : activeTab === "board" ? (
              <>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.08em] text-[#5a5a56]">
                    Group by
                  </span>
                  {BOARD_GROUP_BY_OPTIONS.map((option) => (
                    <a
                      key={option.key}
                      href={myTasksHref({ ...query, tab: "board", groupBy: option.key })}
                      className={data.boardGroupBy === option.key ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      {option.label}
                    </a>
                  ))}
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
