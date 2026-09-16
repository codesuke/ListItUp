import {
  BarChart3,
  Calendar,
  Columns3,
  Download,
  GanttChart,
  LayoutDashboard,
  LayoutList,
  List,
  MessageSquare,
  Paperclip,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";

import { addCalendarMonths, formatCalendarMonthParam, parseCalendarMonth } from "@/lib/calendar/month-grid";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import {
  addItemAction,
  addListMemberAction,
  addSectionAction,
  completeItemAction,
  duplicateSectionAction,
  deleteSectionAction,
  grantGuestAccessAction,
  moveItemToColumnAction,
  moveSectionAction,
  removeListMemberAction,
  renameSectionAction,
  restoreItemAction,
  revokeGuestAccessAction,
  setBoardGroupByAction,
  setListGroupByAction,
  togglePeerComparisonAction,
  updateListDescriptionAction,
} from "./actions";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import { DashboardTab } from "./DashboardTab";
import { FilesView } from "./FilesView";
import { loadListPageData, type ListPageData } from "./page-data";
import { SectionList } from "./SectionList";
import { TimelineView } from "./TimelineView";

type Props = {
  params: Promise<{ workspaceId: string; listId: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
};

type TabKey =
  | "overview"
  | "list"
  | "board"
  | "calendar"
  | "files"
  | "timeline"
  | "dashboard"
  | "messages";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "timeline", label: "Timeline" },
  { key: "files", label: "Files" },
  { key: "dashboard", label: "Dashboard" },
  { key: "messages", label: "Messages" },
];

const TAB_ICON: Record<TabKey, LucideIcon> = {
  overview: LayoutDashboard,
  list: List,
  board: Columns3,
  calendar: Calendar,
  timeline: GanttChart,
  files: Paperclip,
  dashboard: BarChart3,
  messages: MessageSquare,
};

const TAB_KEYS: readonly string[] = TABS.map((tab) => tab.key);

function isTabKey(value: string): value is TabKey {
  return TAB_KEYS.includes(value);
}

// Messages is this spec's deliberately reserved placeholder (v2 Chat/VC
// work). Dashboard shipped in full across #51 and #54-#58; Calendar
// shipped in #32.
const TAB_NOTES: Record<
  Exclude<TabKey, "overview" | "list" | "board" | "calendar" | "timeline" | "files" | "dashboard">,
  string
> = {
  messages: "Reserved — Messages ships with the v2 Chat/VC system.",
};

function tabHref(workspaceId: string, listId: string, tab: TabKey): string {
  return tab === "overview"
    ? `/workspaces/${workspaceId}/lists/${listId}`
    : `/workspaces/${workspaceId}/lists/${listId}?tab=${tab}`;
}

function calendarMonthHref(workspaceId: string, listId: string, month: string): string {
  return `/workspaces/${workspaceId}/lists/${listId}?tab=calendar&month=${month}`;
}

function RolesColumn({
  title,
  entries,
  removeLabel,
  bindRemove,
}: {
  title: string;
  entries: { userId: string; name: string }[];
  removeLabel?: string;
  bindRemove?: (userId: string) => (formData: FormData) => Promise<void>;
}) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{title}</div>
      {entries.length === 0 ? (
        <div className="mt-2 text-sm text-neutral-600">No one yet.</div>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li key={entry.userId} className="flex items-center justify-between gap-2 text-sm text-neutral-300">
              <span className="truncate">{entry.name}</span>
              {bindRemove && (
                <form action={bindRemove(entry.userId)}>
                  <button type="submit" className="text-xs text-neutral-600 hover:text-[#ff8a70]">
                    {removeLabel ?? "Remove"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OverviewTab({
  data,
  boundUpdateDescription,
  boundAddMember,
  boundRemoveMember,
  boundGrantGuest,
  boundRevokeGuest,
}: {
  data: ListPageData;
  boundUpdateDescription: (formData: FormData) => Promise<void>;
  boundAddMember: (formData: FormData) => Promise<void>;
  boundRemoveMember: (userId: string) => (formData: FormData) => Promise<void>;
  boundGrantGuest: (formData: FormData) => Promise<void>;
  boundRevokeGuest: (userId: string) => (formData: FormData) => Promise<void>;
}) {
  const canManage = data.canEditDescription;

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          Description
        </div>
        {canManage ? (
          <form action={boundUpdateDescription} className="mt-2 flex flex-col gap-2">
            <textarea
              name="description"
              defaultValue={data.description ?? ""}
              placeholder="What is this List for?"
              rows={3}
              className="w-full rounded-md border border-neutral-700 bg-[#141414] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#ff6b4a] focus:outline-none"
            />
            <button
              type="submit"
              className="self-start rounded-md bg-[#ff6b4a] px-4 py-1.5 text-sm font-medium text-[#1a0800] hover:bg-[#ff8a70]"
            >
              Save
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">
            {data.description || "No description yet."}
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          Roles
        </div>
        <div className="grid grid-cols-4 gap-6 rounded-lg border border-neutral-800 bg-[#0d0d0d] p-4">
          <RolesColumn title="Lead" entries={data.roles.leads} bindRemove={canManage ? boundRemoveMember : undefined} />
          <RolesColumn title="Member" entries={data.roles.members} bindRemove={canManage ? boundRemoveMember : undefined} />
          <RolesColumn title="Viewer" entries={data.roles.viewers} bindRemove={canManage ? boundRemoveMember : undefined} />
          <RolesColumn
            title="Guest"
            entries={data.roles.guests}
            removeLabel="Revoke"
            bindRemove={canManage ? boundRevokeGuest : undefined}
          />
        </div>

        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {data.eligibleMembers.length > 0 && (
              <form action={boundAddMember} className="flex items-center gap-2">
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="rounded-md border border-neutral-700 bg-[#141414] px-3 py-1.5 text-sm text-neutral-200"
                >
                  <option value="" disabled>
                    Add a Workspace Member…
                  </option>
                  {data.eligibleMembers.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <select
                  name="role"
                  defaultValue="MEMBER"
                  className="rounded-md border border-neutral-700 bg-[#141414] px-3 py-1.5 text-sm text-neutral-200"
                >
                  <option value="MEMBER">as Member</option>
                  <option value="VIEWER">as Viewer</option>
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-[#ff6b4a] hover:text-white"
                >
                  Add
                </button>
              </form>
            )}

            <form action={boundGrantGuest} className="flex items-center gap-2">
              <input
                type="email"
                name="email"
                required
                placeholder="Grant Guest access by email"
                className="min-w-56 rounded-md border border-neutral-700 bg-[#141414] px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#ff6b4a] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-[#ff6b4a] hover:text-white"
              >
                Grant
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ListPage({ params, searchParams }: Props) {
  const { workspaceId, listId } = await params;
  const query = await searchParams;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}/lists/${listId}`);
  const now = new Date();

  const data = await loadListPageData(prisma, {
    userId: session.user.id,
    workspaceId,
    listId,
    now,
    calendarMonth: query.month,
  });

  if (!data) {
    notFound();
  }

  const activeTab: TabKey = query.tab && isTabKey(query.tab) ? query.tab : "overview";
  const calendarMonthStart = parseCalendarMonth(query.month, now);
  const calendarMonthLabel = calendarMonthStart.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prevCalendarMonthHref = calendarMonthHref(
    workspaceId,
    listId,
    formatCalendarMonthParam(addCalendarMonths(calendarMonthStart, -1))
  );
  const nextCalendarMonthHref = calendarMonthHref(
    workspaceId,
    listId,
    formatCalendarMonthParam(addCalendarMonths(calendarMonthStart, 1))
  );
  const boundUpdateDescription = updateListDescriptionAction.bind(null, workspaceId, listId);
  const boundAddMember = addListMemberAction.bind(null, workspaceId, listId);
  const boundRemoveMember = (userId: string) => removeListMemberAction.bind(null, workspaceId, listId, userId);
  const boundGrantGuest = grantGuestAccessAction.bind(null, workspaceId, listId);
  const boundRevokeGuest = (userId: string) => revokeGuestAccessAction.bind(null, workspaceId, listId, userId);
  const boundAddSection = addSectionAction.bind(null, workspaceId, listId);
  // Bound only through workspaceId/listId (never further, e.g. per-Section)
  // — SectionList and BoardView are Client Components, and a Server
  // Component can only pass a Client Component an already-bound Server
  // Action reference, never a hand-written closure that wraps one (React
  // can't serialize an arbitrary closure across that boundary). The
  // remaining argument (sectionId, itemId, direction, ...) gets bound
  // client-side instead, inside those components — binding an
  // already-received Server Action reference further is fine since no
  // additional serialization boundary is crossed at that point.
  const boundRenameSection = renameSectionAction.bind(null, workspaceId, listId);
  const boundDuplicateSection = duplicateSectionAction.bind(null, workspaceId, listId);
  const boundDeleteSection = deleteSectionAction.bind(null, workspaceId, listId);
  const boundMoveSection = moveSectionAction.bind(null, workspaceId, listId);
  const boundSetGroupBy = setListGroupByAction.bind(null, workspaceId, listId);
  const boundAddItem = addItemAction.bind(null, workspaceId, listId);
  const boundSetBoardGroupBy = setBoardGroupByAction.bind(null, workspaceId, listId);
  const boundMoveItem = moveItemToColumnAction.bind(null, workspaceId, listId, data.boardGroupBy);
  const boundRestoreItem = restoreItemAction.bind(null, workspaceId, listId);
  const boundCompleteItem = completeItemAction.bind(null, workspaceId, listId);
  const boundTogglePeerComparison = togglePeerComparisonAction.bind(null, workspaceId, listId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-[#232323] bg-[#0d0d0d] px-7">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutList className="h-4 w-4 flex-shrink-0 text-[#ff8a70]" />
          <span className="truncate text-[13px] font-semibold text-[#e5e5e0]">{data.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Export CSV ships with the Reports & Analytics spec (ADR 0012)."
            className="flex items-center gap-1.5 rounded-[6px] border border-[#333333] px-3 py-[7px] text-[13px] font-semibold text-[#8f8f8a] opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            type="button"
            aria-label="List settings"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-[#333333] bg-[#141414] text-[#8f8f8a] hover:bg-[#1a1a1a] hover:text-[#e5e5e0]"
          >
            <Settings className="h-[15px] w-[15px]" />
          </button>
        </div>
      </header>

      <main className="flex-1 bg-[#080808] px-10 pb-16 pt-8 text-neutral-300">
        <div className="mx-auto max-w-6xl">
          <nav className="mb-6 flex flex-wrap items-center gap-6 border-b border-[#232323]">
            {TABS.map((tab) => {
              const Icon = TAB_ICON[tab.key];
              const isDisabledTab = tab.key === "messages";
              return (
                <a
                  key={tab.key}
                  href={tabHref(workspaceId, listId, tab.key)}
                  className={
                    isDisabledTab
                      ? "flex cursor-default items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-semibold text-[#5a5a56]"
                      : activeTab === tab.key
                        ? "flex items-center gap-1.5 border-b-2 border-[#ff6b4a] py-3 text-[13px] font-semibold text-[#e5e5e0]"
                        : "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-semibold text-[#8f8f8a] hover:text-[#e5e5e0]"
                  }
                >
                  <Icon className="h-3.5 w-3.5" /> {tab.label}
                  {isDisabledTab && (
                    <span className="ml-1 rounded-[5px] bg-[#202020] px-[7px] py-[2px] font-[family-name:var(--font-mono-label)] text-[10px] font-semibold tracking-[0.05em] text-[#8f8f8a]">
                      v2
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          {activeTab === "overview" ? (
          <OverviewTab
            data={data}
            boundUpdateDescription={boundUpdateDescription}
            boundAddMember={boundAddMember}
            boundRemoveMember={boundRemoveMember}
            boundGrantGuest={boundGrantGuest}
            boundRevokeGuest={boundRevokeGuest}
          />
        ) : activeTab === "list" ? (
          <SectionList
            sections={data.sections}
            unsectionedItems={data.unsectionedItems}
            archivedItems={data.archivedItems}
            canManage={data.canManageSections}
            groupBy={data.groupBy}
            workspaceId={workspaceId}
            listId={listId}
            boundAddSection={boundAddSection}
            boundRenameSection={boundRenameSection}
            boundDuplicateSection={boundDuplicateSection}
            boundDeleteSection={boundDeleteSection}
            boundMoveSection={boundMoveSection}
            boundSetGroupBy={boundSetGroupBy}
            boundAddItem={boundAddItem}
            boundRestoreItem={boundRestoreItem}
            boundCompleteItem={boundCompleteItem}
          />
        ) : activeTab === "board" ? (
          <BoardView
            columns={data.boardColumns}
            groupBy={data.boardGroupBy}
            canManage={data.canManageSections}
            workspaceId={workspaceId}
            listId={listId}
            archivedItems={data.archivedItems}
            boundSetGroupBy={boundSetBoardGroupBy}
            boundMoveItem={boundMoveItem}
            boundRestoreItem={boundRestoreItem}
          />
        ) : activeTab === "calendar" ? (
          <CalendarView
            cells={data.calendarCells}
            monthLabel={calendarMonthLabel}
            prevHref={prevCalendarMonthHref}
            nextHref={nextCalendarMonthHref}
            workspaceId={workspaceId}
            listId={listId}
            now={now}
          />
        ) : activeTab === "timeline" ? (
          <TimelineView items={data.timelineItems} workspaceId={workspaceId} listId={listId} />
        ) : activeTab === "files" ? (
          <FilesView entries={data.filesViewEntries} workspaceId={workspaceId} listId={listId} />
        ) : activeTab === "dashboard" ? (
          <DashboardTab
            counts={data.dashboard.counts}
            bySection={data.dashboard.bySection}
            byState={data.dashboard.byState}
            completionOverTime={data.dashboard.completionOverTime}
            progressPercent={data.dashboard.progressPercent}
            completionHeatmap={data.dashboard.completionHeatmap}
            contributionMap={data.dashboard.contributionMap}
            attentionImbalance={data.dashboard.attentionImbalance}
            peerComparisonEnabled={data.dashboard.peerComparisonEnabled}
            canTogglePeerComparison={data.dashboard.canTogglePeerComparison}
            boundTogglePeerComparison={boundTogglePeerComparison}
          />
        ) : (
          <div className="mt-10 rounded-lg border border-dashed border-neutral-800 px-4 py-16 text-center text-sm text-neutral-600">
            {TAB_NOTES[activeTab]}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
