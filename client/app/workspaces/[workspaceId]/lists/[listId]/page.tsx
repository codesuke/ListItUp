import {
  BarChart3,
  Calendar,
  Columns3,
  Download,
  GanttChart,
  LayoutDashboard,
  List,
  MessageSquare,
  Paperclip,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ADD_BUTTON_SECONDARY } from "@/components/workspace/add-button";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { addCalendarMonths, formatCalendarMonthParam, parseCalendarMonth } from "@/lib/calendar/month-grid";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import {
  addItemAction,
  addListAccessByEmailAction,
  addListMemberAction,
  completeItemAction,
  moveItemToColumnAction,
  moveListRoleAssignmentAction,
  promoteListMemberToLeadAction,
  removeListMemberAction,
  restoreItemAction,
  revokeGuestAccessAction,
  setBoardGroupByAction,
  setListStatusAction,
  stepDownFromListLeadAction,
  togglePeerComparisonAction,
  uncompleteItemAction,
  updateListDescriptionAction,
} from "./actions";
import type { ListRoleActionResult } from "./actions";
import { AddListAccessByEmailForm } from "./AddListAccessByEmailForm";
import { AddListMemberForm } from "./AddListMemberForm";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import { DashboardTab } from "./DashboardTab";
import { DescriptionForm } from "./DescriptionForm";
import { FilesView } from "./FilesView";
import { ListStatusControl } from "./ListStatusControl";
import { OverviewRolesBoard } from "./OverviewRolesBoard";
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

function OverviewTab({
  data,
  currentUserId,
  boundUpdateDescription,
  boundAddMember,
  boundRemoveMember,
  boundAddByEmail,
  boundRevokeGuest,
  boundMoveRole,
  boundPromoteToLead,
  boundStepDown,
}: {
  data: ListPageData;
  currentUserId: string;
  boundUpdateDescription: (formData: FormData) => Promise<void>;
  boundAddMember: (prevState: ListRoleActionResult, formData: FormData) => Promise<ListRoleActionResult>;
  boundRemoveMember: (userId: string) => Promise<ListRoleActionResult>;
  boundAddByEmail: (prevState: ListRoleActionResult, formData: FormData) => Promise<ListRoleActionResult>;
  boundRevokeGuest: (userId: string) => Promise<void>;
  boundMoveRole: (userId: string, toRole: string) => Promise<ListRoleActionResult>;
  boundPromoteToLead: (userId: string) => Promise<ListRoleActionResult>;
  boundStepDown: (userId: string) => Promise<ListRoleActionResult>;
}) {
  const canManage = data.canEditDescription;
  // Same LEAD threshold as the Roles panel's other controls (ADR 0016
  // removed the separate, stricter "ADMIN" access level this used to be
  // scoped to).
  const canDragRoles = canManage;

  return (
    <div className="mt-6 flex flex-col gap-10">
      <div>
        <div className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">Description</div>
        {canManage ? (
          <DescriptionForm description={data.description} boundUpdateDescription={boundUpdateDescription} />
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{data.description || "No description yet."}</p>
        )}
      </div>

      <div>
        <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-muted">Roles</div>
        <OverviewRolesBoard
          roles={data.roles}
          currentUserId={currentUserId}
          canManageRoles={canManage}
          canDrag={canDragRoles}
          boundRemoveMember={boundRemoveMember}
          boundRevokeGuest={boundRevokeGuest}
          boundMoveRole={boundMoveRole}
          boundPromoteToLead={boundPromoteToLead}
          boundStepDown={boundStepDown}
        />
      </div>

      {canManage && (
        <div>
          <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-muted">Manage Access</div>
          <div className="flex flex-wrap items-center gap-6">
            {data.eligibleMembers.length > 0 && (
              <AddListMemberForm eligibleMembers={data.eligibleMembers} boundAddMember={boundAddMember} />
            )}

            <AddListAccessByEmailForm boundAddByEmail={boundAddByEmail} />
          </div>
        </div>
      )}
    </div>
  );
}

export default async function ListPage({ params, searchParams }: Props) {
  const { workspaceId, listId } = await params;
  const query = await searchParams;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}/lists/${listId}`);
  const now = new Date();

  const [data, unreadNotificationCount] = await Promise.all([
    loadListPageData(prisma, {
      userId: session.user.id,
      workspaceId,
      listId,
      now,
      calendarMonth: query.month,
    }),
    countUnreadNotifications(prisma, session.user.id),
  ]);

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
  const boundSetStatus = setListStatusAction.bind(null, workspaceId, listId);
  const boundAddMember = addListMemberAction.bind(null, workspaceId, listId);
  const boundRemoveMember = removeListMemberAction.bind(null, workspaceId, listId);
  const boundAddByEmail = addListAccessByEmailAction.bind(null, workspaceId, listId);
  const boundRevokeGuest = revokeGuestAccessAction.bind(null, workspaceId, listId);
  const boundMoveRole = moveListRoleAssignmentAction.bind(null, workspaceId, listId);
  const boundPromoteToLead = promoteListMemberToLeadAction.bind(null, workspaceId, listId);
  const boundStepDown = stepDownFromListLeadAction.bind(null, workspaceId, listId);
  // Bound only through workspaceId/listId (never further, e.g. per-Item) —
  // SectionList and BoardView are Client Components, and a Server Component
  // can only pass a Client Component an already-bound Server Action
  // reference, never a hand-written closure that wraps one (React can't
  // serialize an arbitrary closure across that boundary). The remaining
  // argument (sectionId, itemId, direction, ...) gets bound client-side
  // instead, inside those components — binding an already-received Server
  // Action reference further is fine since no additional serialization
  // boundary is crossed at that point.
  const boundAddItem = addItemAction.bind(null, workspaceId, listId);
  const boundSetBoardGroupBy = setBoardGroupByAction.bind(null, workspaceId, listId);
  const boundMoveItem = moveItemToColumnAction.bind(null, workspaceId, listId, data.boardGroupBy);
  const boundRestoreItem = restoreItemAction.bind(null, workspaceId, listId);
  const boundCompleteItem = completeItemAction.bind(null, workspaceId, listId);
  const boundUncompleteItem = uncompleteItemAction.bind(null, workspaceId, listId);
  const boundTogglePeerComparison = togglePeerComparisonAction.bind(null, workspaceId, listId);

  return (
    <div className="flex min-h-screen flex-col animate-in fade-in duration-200">
      <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
        <span className="truncate text-[13px] font-semibold text-ink">{data.name}</span>
        <div className="flex items-center gap-3">
          {data.canExport ? (
            <a
              href={`/api/workspaces/${workspaceId}/lists/${listId}/export`}
              download
              className={ADD_BUTTON_SECONDARY}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          ) : null}
          <GlobalHeaderActions
            currentUserName={session.user.name}
            unreadNotificationCount={unreadNotificationCount}
            workspaceId={workspaceId}
          />
        </div>
      </header>

      <main className="flex-1 bg-canvas px-10 pb-16 pt-8 text-ink">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center gap-3">
            <h1 className="text-[17px] font-semibold text-ink">{data.name}</h1>
            <span className="text-[12.5px] text-ink-muted">{data.workspaceName}</span>
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <ListStatusControl status={data.status} canEdit={data.canEditDescription} boundSetStatus={boundSetStatus} />
            {data.archivedAt && (
              <span className="rounded-[5px] bg-surface-4 px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                Archived
              </span>
            )}
          </div>

          <nav className="mb-6 flex flex-wrap items-center gap-6 border-b border-line">
            {TABS.map((tab) => {
              const Icon = TAB_ICON[tab.key];
              const isDisabledTab = tab.key === "messages";
              return (
                <Link
                  key={tab.key}
                  href={tabHref(workspaceId, listId, tab.key)}
                  className={
                    isDisabledTab
                      ? "flex cursor-default items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-semibold text-ink-muted opacity-50"
                      : activeTab === tab.key
                        ? "flex items-center gap-1.5 border-b-2 border-[#ff6b4a] py-3 text-[13px] font-semibold text-ink transition-colors duration-150"
                        : "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-semibold text-ink-muted transition-colors duration-150 hover:text-ink"
                  }
                >
                  <Icon className="h-3.5 w-3.5" /> {tab.label}
                  {isDisabledTab && (
                    <span className="ml-1 rounded-[5px] bg-surface-4 px-[7px] py-[2px] text-[10px] font-semibold tracking-[0.05em] text-ink-muted">
                      v2
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {activeTab === "overview" ? (
          <OverviewTab
            data={data}
            currentUserId={session.user.id}
            boundUpdateDescription={boundUpdateDescription}
            boundAddMember={boundAddMember}
            boundRemoveMember={boundRemoveMember}
            boundAddByEmail={boundAddByEmail}
            boundRevokeGuest={boundRevokeGuest}
            boundMoveRole={boundMoveRole}
            boundPromoteToLead={boundPromoteToLead}
            boundStepDown={boundStepDown}
          />
        ) : activeTab === "list" ? (
          <SectionList
            sections={data.sections}
            unsectionedItems={data.unsectionedItems}
            canManage={data.canManageSections}
            workspaceId={workspaceId}
            listId={listId}
            boundAddItem={boundAddItem}
            boundCompleteItem={boundCompleteItem}
            boundUncompleteItem={boundUncompleteItem}
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
          <TimelineView
            items={data.timelineItems}
            sections={data.sections.map((section) => ({ id: section.id, name: section.name }))}
            workspaceId={workspaceId}
            listId={listId}
            now={now}
          />
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
          <div className="mt-10 px-4 py-16 text-center text-sm text-ink-muted">{TAB_NOTES[activeTab]}</div>
        )}
        </div>
      </main>
    </div>
  );
}
