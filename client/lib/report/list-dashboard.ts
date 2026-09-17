import type { ItemState } from "@/generated/prisma/client";

export type DashboardItem = {
  state: ItemState;
  dueDate: Date | null;
  sectionId: string | null;
  updatedAt: Date;
};

export type ItemCounts = {
  total: number;
  completed: number;
  incomplete: number;
  overdue: number;
};

// Narrower than DashboardItem — only state/dueDate are read below, which
// lets callers with a different Item shape (e.g. My Tasks' MyTaskItem,
// #52) reuse this without carrying List Dashboard-only fields.
type CountableItem = { state: ItemState; dueDate: Date | null };

// Incomplete is everything not Complete (To Do/In Progress/Blocked all
// count); Overdue only counts a past due date on an Item that isn't
// already Complete (#51).
export function computeItemCounts(items: CountableItem[], now: Date): ItemCounts {
  const completed = items.filter((item) => item.state === "COMPLETE").length;
  const overdue = items.filter(
    (item) => item.state !== "COMPLETE" && item.dueDate !== null && item.dueDate.getTime() < now.getTime()
  ).length;

  return { total: items.length, completed, incomplete: items.length - completed, overdue };
}

export type SectionBreakdownEntry = { sectionId: string | null; sectionName: string; count: number };

const UNSECTIONED_LABEL = "No Section";

// One entry per Section in the given order, plus a trailing "No Section"
// entry only when there are unsectioned Items to show (#51).
export function breakdownBySection(
  items: DashboardItem[],
  sections: { id: string; name: string }[]
): SectionBreakdownEntry[] {
  const countsBySectionId = new Map<string | null, number>();
  for (const item of items) {
    countsBySectionId.set(item.sectionId, (countsBySectionId.get(item.sectionId) ?? 0) + 1);
  }

  const entries = sections.map((section) => ({
    sectionId: section.id as string | null,
    sectionName: section.name,
    count: countsBySectionId.get(section.id) ?? 0,
  }));

  const unsectionedCount = countsBySectionId.get(null) ?? 0;
  if (unsectionedCount > 0) {
    entries.push({ sectionId: null, sectionName: UNSECTIONED_LABEL, count: unsectionedCount });
  }

  return entries;
}

export type StateBreakdownEntry = { state: ItemState; label: string; count: number };

// Fixed display order shared with Board's columns (lib/list/list-board.ts)
// so state ordering reads the same across the app.
const STATE_BREAKDOWN_ORDER: { key: ItemState; label: string }[] = [
  { key: "TO_DO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "COMPLETE", label: "Complete" },
];

export function breakdownByState(items: { state: ItemState }[]): StateBreakdownEntry[] {
  const countsByState = new Map<ItemState, number>();
  for (const item of items) {
    countsByState.set(item.state, (countsByState.get(item.state) ?? 0) + 1);
  }

  return STATE_BREAKDOWN_ORDER.map(({ key, label }) => ({
    state: key,
    label,
    count: countsByState.get(key) ?? 0,
  }));
}

export type CompletionOverTimePoint = { date: string; cumulativeCompleted: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Narrower than DashboardItem — only state/updatedAt are read below (same
// rationale as CountableItem above), which lets callers with a different
// Item shape (e.g. My Tasks' MyTaskItem, #46) reuse this without carrying
// List Dashboard-only fields like sectionId.
type CompletionTimelineItem = { state: ItemState; updatedAt: Date };

// Item has no dedicated completion timestamp (schema.prisma) — this uses
// updatedAt as an approximation of "when it was completed" for Items
// currently Complete, the same kind of documented approximation Home's
// assigned-by-me query makes (lib/item/item-assigned-by-me.ts). A running
// cumulative total across a trailing window, carrying forward completions
// from before the window starts (#51).
export function buildCompletionOverTime(
  items: CompletionTimelineItem[],
  now: Date,
  days: number
): CompletionOverTimePoint[] {
  const completedCountsByDay = new Map<string, number>();
  for (const item of items) {
    if (item.state !== "COMPLETE") continue;
    const key = toDateKey(item.updatedAt);
    completedCountsByDay.set(key, (completedCountsByDay.get(key) ?? 0) + 1);
  }

  const rangeStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * MS_PER_DAY;

  let cumulative = 0;
  for (const [key, count] of completedCountsByDay) {
    if (new Date(`${key}T00:00:00.000Z`).getTime() < rangeStartMs) {
      cumulative += count;
    }
  }

  const points: CompletionOverTimePoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayKey = toDateKey(new Date(rangeStartMs + i * MS_PER_DAY));
    cumulative += completedCountsByDay.get(dayKey) ?? 0;
    points.push({ date: dayKey, cumulativeCompleted: cumulative });
  }

  return points;
}

// Progress donut (#55): share of all active Items that are Complete.
export function computeProgressPercent(counts: ItemCounts): number {
  return counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100);
}

export type HeatmapCell = { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 };

// Completion Heatmap (#54): a GitHub-style grid of Complete counts per day
// over a trailing window of full weeks, bucketed into 5 intensity levels
// relative to the window's busiest day — aggregated across the whole List,
// never per-Member (the mock's "Rhythm of work" framing).
export function buildCompletionHeatmap(items: DashboardItem[], now: Date, weeks: number): HeatmapCell[][] {
  const days = weeks * 7;
  const completedCountsByDay = new Map<string, number>();
  for (const item of items) {
    if (item.state !== "COMPLETE") continue;
    const key = toDateKey(item.updatedAt);
    completedCountsByDay.set(key, (completedCountsByDay.get(key) ?? 0) + 1);
  }

  const rangeStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * MS_PER_DAY;

  const cells: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const dayKey = toDateKey(new Date(rangeStartMs + i * MS_PER_DAY));
    cells.push({ date: dayKey, count: completedCountsByDay.get(dayKey) ?? 0 });
  }

  const maxCount = Math.max(0, ...cells.map((cell) => cell.count));
  const intensityFor = (count: number): HeatmapCell["intensity"] => {
    if (count === 0 || maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const weekColumns: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    weekColumns.push(
      cells.slice(w * 7, w * 7 + 7).map((cell) => ({ ...cell, intensity: intensityFor(cell.count) }))
    );
  }

  return weekColumns;
}

export type MemberAssignmentItem = { state: ItemState; dueDate: Date | null; assigneeUserIds: string[] };

export type ContributionEntry = { userId: string; name: string; completionRatePercent: number };

// Contribution Map (#56): "who is moving work forward" as a normalized
// completion rate (Items completed ÷ Items assigned), never a raw count —
// a Member with 2 Items and both done outranks one with 20 Items and 5
// done. Only Members with at least one assigned Item appear, ranked
// highest rate first.
export function buildContributionMap(
  items: MemberAssignmentItem[],
  members: { userId: string; name: string }[]
): ContributionEntry[] {
  const assignedCounts = new Map<string, number>();
  const completedCounts = new Map<string, number>();

  for (const item of items) {
    for (const userId of item.assigneeUserIds) {
      assignedCounts.set(userId, (assignedCounts.get(userId) ?? 0) + 1);
      if (item.state === "COMPLETE") {
        completedCounts.set(userId, (completedCounts.get(userId) ?? 0) + 1);
      }
    }
  }

  return members
    .filter((member) => (assignedCounts.get(member.userId) ?? 0) > 0)
    .map((member) => {
      const assigned = assignedCounts.get(member.userId) ?? 0;
      const completed = completedCounts.get(member.userId) ?? 0;
      return {
        userId: member.userId,
        name: member.name,
        completionRatePercent: Math.round((completed / assigned) * 100),
      };
    })
    .sort((a, b) => b.completionRatePercent - a.completionRatePercent);
}

export type ListContributionEntry = { listId: string; label: string; completionRatePercent: number };

type ListContributionItem = { listId: string; listName: string; state: ItemState };

// Personal Contribution Map (My Tasks, #50): "how consistently is work
// being moved forward" has no other-User axis on My Tasks — a User only
// ever sees their own assigned Items there (docs/QnA/reports-analytics-
// scope.md Q17) — so this breaks the same normalized completion-rate
// metric (assigned vs. completed) down per source List instead of per
// Member, showing where the User follows through consistently vs. not.
// Never another User's data: the caller only ever passes the current
// User's own My Tasks Item set. Lists with zero assigned Items are
// excluded entirely, not shown at 0%, matching buildContributionMap.
export function buildPersonalContributionByList(items: ListContributionItem[]): ListContributionEntry[] {
  const byListId = new Map<string, { label: string; assigned: number; completed: number }>();

  for (const item of items) {
    const entry = byListId.get(item.listId) ?? { label: item.listName, assigned: 0, completed: 0 };
    entry.assigned += 1;
    if (item.state === "COMPLETE") entry.completed += 1;
    byListId.set(item.listId, entry);
  }

  return [...byListId.entries()]
    .map(([listId, { label, assigned, completed }]) => ({
      listId,
      label,
      completionRatePercent: Math.round((completed / assigned) * 100),
    }))
    .sort((a, b) => b.completionRatePercent - a.completionRatePercent);
}

export type AttentionAxis = "TO_DO" | "BLOCKED" | "OVERDUE" | "DONE";

const ATTENTION_AXES: readonly AttentionAxis[] = ["TO_DO", "BLOCKED", "OVERDUE", "DONE"];

export type AttentionImbalanceEntry = {
  userId: string;
  name: string;
  normalized: Record<AttentionAxis, number>;
};

function emptyAxisCounts(): Record<AttentionAxis, number> {
  return { TO_DO: 0, BLOCKED: 0, OVERDUE: 0, DONE: 0 };
}

// Attention Imbalance (#57): where a List's attention is skewed across its
// people, one axis per state-of-concern (To Do, Blocked, Overdue, Done).
// Each axis is normalized against its own busiest Member (0..1) so the
// radar reads as relative skew, not absolute workload — a Member with the
// most Blocked Items reaches the outer ring on that axis regardless of how
// that compares to Done.
export function buildAttentionImbalance(
  items: MemberAssignmentItem[],
  members: { userId: string; name: string }[],
  now: Date
): AttentionImbalanceEntry[] {
  const rawByUserId = new Map<string, Record<AttentionAxis, number>>();

  const bump = (userId: string, axis: AttentionAxis) => {
    const counts = rawByUserId.get(userId) ?? emptyAxisCounts();
    counts[axis] += 1;
    rawByUserId.set(userId, counts);
  };

  for (const item of items) {
    for (const userId of item.assigneeUserIds) {
      if (item.state === "TO_DO") bump(userId, "TO_DO");
      if (item.state === "BLOCKED") bump(userId, "BLOCKED");
      if (item.state === "COMPLETE") bump(userId, "DONE");
      if (item.state !== "COMPLETE" && item.dueDate !== null && item.dueDate.getTime() < now.getTime()) {
        bump(userId, "OVERDUE");
      }
    }
  }

  const maxByAxis = emptyAxisCounts();
  for (const counts of rawByUserId.values()) {
    for (const axis of ATTENTION_AXES) {
      maxByAxis[axis] = Math.max(maxByAxis[axis], counts[axis]);
    }
  }

  return members
    .filter((member) => rawByUserId.has(member.userId))
    .map((member) => {
      const raw = rawByUserId.get(member.userId)!;
      const normalized = emptyAxisCounts();
      for (const axis of ATTENTION_AXES) {
        normalized[axis] = maxByAxis[axis] === 0 ? 0 : raw[axis] / maxByAxis[axis];
      }
      return { userId: member.userId, name: member.name, normalized };
    });
}
