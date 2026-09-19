import type { ItemPriority, ItemState, ListStatus, PrismaClient } from "@/generated/prisma/client";
import { buildMonthGrid, parseCalendarMonth, type MonthGridCell } from "@/lib/calendar/month-grid";
import { groupItemsForBoard, isValidBoardGroupBy, type BoardColumn, type BoardItem } from "@/lib/list/list-board";
import { buildFilesViewEntries, type FilesViewEntry } from "@/lib/list/list-files";
import { getListRoles, type ListRoles } from "@/lib/list/list-roles";
import { buildTimelineItems, type TimelineItem } from "@/lib/list/list-timeline";
import {
  meetsListAccessLevel,
  resolveListAccess,
  type ListAccessLevel,
} from "@/lib/permissions/list-access";
import {
  breakdownBySection,
  breakdownByState,
  buildAttentionImbalance,
  buildCompletionHeatmap,
  buildCompletionOverTime,
  buildContributionMap,
  computeItemCounts,
  computeProgressPercent,
  type AttentionImbalanceEntry,
  type CompletionOverTimePoint,
  type ContributionEntry,
  type HeatmapCell,
  type ItemCounts,
  type SectionBreakdownEntry,
  type StateBreakdownEntry,
} from "@/lib/report/list-dashboard";

const COMPLETION_OVER_TIME_DAYS = 14;
const COMPLETION_HEATMAP_WEEKS = 52;
// Contribution Map and Attention Imbalance are per-person widgets — capped
// so the bar list and radar chart stay legible on a List with a large team.
const CONTRIBUTION_MAP_LIMIT = 6;
const ATTENTION_IMBALANCE_LIMIT = 4;

export type EligibleWorkspaceMember = { userId: string; name: string };

export type ItemSummary = {
  id: string;
  title: string;
  state: ItemState;
  priority: ItemPriority;
  dueDate: Date | null;
  hasParent: boolean;
  assignees: { userId: string; name: string }[];
  labels: { id: string; name: string }[];
  // Dependency facet (design-mocks/list-view's "link-2" icon) counts both
  // directions — an Item that blocks others and one that's blocked by
  // others are equally "linked" for this at-a-glance count.
  dependencyCount: number;
  noteCount: number;
  attachmentCount: number;
};

export type SectionWithItems = {
  id: string;
  name: string;
  order: number;
  items: ItemSummary[];
};

export type ListPageData = {
  listId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ListStatus;
  archivedAt: Date | null;
  access: ListAccessLevel;
  // >=LEAD governs both editing Description and managing the Roles panel
  // (#27, #28) — one flag for both since they share the same threshold.
  canEditDescription: boolean;
  roles: ListRoles;
  // Workspace Members not yet holding any List-level role — the candidate
  // pool for the Roles panel's "add Member/Viewer" control (#28). Guest
  // grants aren't drawn from this list since a Guest need not be a
  // Workspace Member at all.
  eligibleMembers: EligibleWorkspaceMember[];
  // >=WRITE governs Section management, the "Add Rule" grouping control,
  // and Item creation (#29, #30) — a List Member manages these, unlike
  // Description/Roles which are Lead-only.
  canManageSections: boolean;
  sections: SectionWithItems[];
  // Items with no Section, grouped separately since the List view still
  // has to show them somewhere.
  unsectionedItems: ItemSummary[];
  // Archived Items in this List, most-recently-updated first — the List
  // and Board views' Archived toggle browses this flat list and Restores
  // from it (#38). Excluded from sections/unsectionedItems/boardColumns/
  // timelineItems/filesViewEntries above, same as before.
  archivedItems: ItemSummary[];
  groupBy: string;
  boardGroupBy: string;
  boardColumns: BoardColumn[];
  // List Leads/Members — the candidate pool for Board's Assignee grouping
  // and per-card "move to" affordance, same reasoning as the Item detail
  // page's assignableMembers (#30).
  assignableMembers: EligibleWorkspaceMember[];
  // Timeline view's date bars (#33) — every non-Archived Item with a due
  // date, sorted earliest-due-first; Dependency arrows are not rendered.
  timelineItems: TimelineItem[];
  // Files view (#22) — every Attachment across the List's Items, newest
  // first.
  filesViewEntries: FilesViewEntry[];
  // Calendar tab (#32) — the viewed month's grid, built over the same
  // active (non-Archived) Items as the rest of the page. Items with no due
  // date don't appear on any day.
  calendarCells: MonthGridCell<ItemSummary>[];
  // Dashboard tab's widgets (#51, #54-#58) — computed over the same active
  // (non-Archived) Items as the rest of the page, not a separate query.
  dashboard: {
    counts: ItemCounts;
    bySection: SectionBreakdownEntry[];
    byState: StateBreakdownEntry[];
    completionOverTime: CompletionOverTimePoint[];
    progressPercent: number;
    completionHeatmap: HeatmapCell[][];
    contributionMap: ContributionEntry[];
    attentionImbalance: AttentionImbalanceEntry[];
    // Off by default; only a Workspace Owner/Admin (canTogglePeerComparison)
    // can flip it, and it governs whether Contribution Map/Attention
    // Imbalance above show every List Member or just the viewer (#58).
    peerComparisonEnabled: boolean;
    canTogglePeerComparison: boolean;
  };
};

// Kept separate from the page component (same rationale as the
// List-browsing page's page-data.ts): a real Next.js request scope isn't
// available under plain tsx, so headers()/session lookup stays in page.tsx
// while everything testable lives here on an injected PrismaClient.
export async function loadListPageData(
  database: PrismaClient,
  input: { userId: string; workspaceId: string; listId: string; now?: Date; calendarMonth?: string }
): Promise<ListPageData | null> {
  const { userId, workspaceId, listId, now = new Date(), calendarMonth } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list || list.workspaceId !== workspaceId) {
    return null;
  }

  const access = await resolveListAccess(database, { userId, listId });
  if (!meetsListAccessLevel(access, "READ")) {
    return null;
  }

  const [roles, workspaceMembers, workspace, sections, allItems] = await Promise.all([
    getListRoles(database, { listId }),
    database.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    database.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { peerComparisonEnabled: true },
    }),
    database.section.findMany({ where: { listId }, orderBy: { order: "asc" } }),
    database.item.findMany({
      where: { listId },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        attachments: { include: { uploader: { select: { name: true } } } },
        labels: { include: { label: { select: { id: true, name: true } } } },
        _count: { select: { blocking: true, blockedBy: true, notes: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Sections/Board/Timeline/Files only ever show active Items — Archived
  // Items are browsable via their own filter/toggle inside the List and
  // Board views instead (#38).
  const items = allItems.filter((item) => item.state !== "ARCHIVED");
  const archivedItems = allItems
    .filter((item) => item.state === "ARCHIVED")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const existingListRoleUserIds = new Set(
    [...roles.leads, ...roles.members, ...roles.viewers].map((entry) => entry.userId)
  );
  const eligibleMembers = workspaceMembers
    .filter((member) => !existingListRoleUserIds.has(member.userId))
    .map((member) => ({ userId: member.userId, name: member.user.name }));

  const toItemSummary = (item: (typeof items)[number]): ItemSummary => ({
    id: item.id,
    title: item.title,
    state: item.state,
    priority: item.priority,
    dueDate: item.dueDate,
    hasParent: item.parentId !== null,
    assignees: item.assignees.map((assignee) => ({
      userId: assignee.userId,
      name: assignee.user.name,
    })),
    labels: item.labels.map((itemLabel) => ({ id: itemLabel.label.id, name: itemLabel.label.name })),
    dependencyCount: item._count.blocking + item._count.blockedBy,
    noteCount: item._count.notes,
    attachmentCount: item.attachments.length,
  });

  const itemsBySectionId = new Map<string, ItemSummary[]>();
  const unsectionedItems: ItemSummary[] = [];
  for (const item of items) {
    if (!item.sectionId) {
      unsectionedItems.push(toItemSummary(item));
      continue;
    }
    const bucket = itemsBySectionId.get(item.sectionId) ?? [];
    bucket.push(toItemSummary(item));
    itemsBySectionId.set(item.sectionId, bucket);
  }

  const assignableMembers = [...roles.leads, ...roles.members];
  const boardGroupBy = isValidBoardGroupBy(list.boardGroupBy) ? list.boardGroupBy : "STATE";
  const boardItems: BoardItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    priority: item.priority,
    dueDate: item.dueDate,
    hasParent: item.parentId !== null,
    sectionId: item.sectionId,
    state: item.state,
    assignees: item.assignees.map((assignee) => ({ userId: assignee.userId, name: assignee.user.name })),
  }));
  const boardColumns = groupItemsForBoard(
    boardItems,
    boardGroupBy,
    sections.map((section) => ({ id: section.id, name: section.name })),
    assignableMembers
  );
  const timelineItems = buildTimelineItems(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      state: item.state,
      priority: item.priority,
      hasParent: item.parentId !== null,
      startDate: item.startDate,
      dueDate: item.dueDate,
    }))
  );
  const dashboardItems = items.map((item) => ({
    state: item.state,
    dueDate: item.dueDate,
    sectionId: item.sectionId,
    updatedAt: item.updatedAt,
  }));
  const counts = computeItemCounts(dashboardItems, now);
  const memberAssignmentItems = items.map((item) => ({
    state: item.state,
    dueDate: item.dueDate,
    assigneeUserIds: item.assignees.map((assignee) => assignee.userId),
  }));
  // Off, Contribution Map/Attention Imbalance show only the viewer's own
  // row; on, every List Lead/Member becomes comparable (#58).
  const peerComparisonCandidates = workspace.peerComparisonEnabled
    ? assignableMembers
    : assignableMembers.filter((member) => member.userId === userId);

  const dashboard = {
    counts,
    bySection: breakdownBySection(
      dashboardItems,
      sections.map((section) => ({ id: section.id, name: section.name }))
    ),
    byState: breakdownByState(dashboardItems),
    completionOverTime: buildCompletionOverTime(dashboardItems, now, COMPLETION_OVER_TIME_DAYS),
    progressPercent: computeProgressPercent(counts),
    completionHeatmap: buildCompletionHeatmap(dashboardItems, now, COMPLETION_HEATMAP_WEEKS),
    contributionMap: buildContributionMap(memberAssignmentItems, peerComparisonCandidates).slice(
      0,
      CONTRIBUTION_MAP_LIMIT
    ),
    attentionImbalance: buildAttentionImbalance(memberAssignmentItems, peerComparisonCandidates, now).slice(
      0,
      ATTENTION_IMBALANCE_LIMIT
    ),
    peerComparisonEnabled: workspace.peerComparisonEnabled,
    canTogglePeerComparison: access === "ADMIN",
  };

  const calendarMonthStart = parseCalendarMonth(calendarMonth, now);
  const calendarCells = buildMonthGrid(items.map(toItemSummary), calendarMonthStart);

  const filesViewEntries = buildFilesViewEntries(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      attachments: item.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        sizeBytes: attachment.sizeBytes,
        uploaderName: attachment.uploader.name,
        createdAt: attachment.createdAt,
      })),
    }))
  );

  return {
    listId: list.id,
    workspaceId: list.workspaceId,
    name: list.name,
    description: list.description,
    status: list.status,
    archivedAt: list.archivedAt,
    access,
    canEditDescription: meetsListAccessLevel(access, "LEAD"),
    roles,
    eligibleMembers,
    canManageSections: meetsListAccessLevel(access, "WRITE"),
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      order: section.order,
      items: itemsBySectionId.get(section.id) ?? [],
    })),
    unsectionedItems,
    archivedItems: archivedItems.map(toItemSummary),
    groupBy: list.groupBy,
    boardGroupBy,
    boardColumns,
    assignableMembers,
    timelineItems,
    filesViewEntries,
    calendarCells,
    dashboard,
  };
}
