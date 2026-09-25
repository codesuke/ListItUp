import type { ItemPriority, ItemState } from "@/generated/prisma/client";

export type TimelineItem = {
  id: string;
  title: string;
  state: ItemState;
  priority: ItemPriority;
  hasParent: boolean;
  sectionId: string | null;
  assignees: { userId: string; name: string }[];
  // Optional and independent of dueDate — a bar renders from startDate to
  // dueDate when present, or as a milestone marker at dueDate otherwise.
  startDate: Date | null;
  dueDate: Date;
};

type TimelineCandidate = Omit<TimelineItem, "dueDate"> & { dueDate: Date | null };

// Pure — the filter/sort shape is unit tested directly without a database.
// An Item with no due date has nothing to draw a bar from and is excluded
// entirely (#33) — Dependency-arrow rendering is explicitly out of scope
// for this view.
export function buildTimelineItems(items: TimelineCandidate[]): TimelineItem[] {
  return items
    .filter((item): item is TimelineCandidate & { dueDate: Date } => item.dueDate !== null)
    .map((item) => ({ ...item, dueDate: item.dueDate }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export type TimelineDateRange = { start: Date; end: Date };

// The earliest bar-start and latest due date across all Timeline Items —
// the span the day-column grid has to cover. Pure — unit tested directly
// without a database.
export function getTimelineDateRange(items: TimelineItem[]): TimelineDateRange | null {
  if (items.length === 0) {
    return null;
  }

  const barStartTimes = items.map((item) => (item.startDate ?? item.dueDate).getTime());
  const dueDateTimes = items.map((item) => item.dueDate.getTime());
  return {
    start: new Date(Math.min(...barStartTimes)),
    end: new Date(Math.max(...dueDateTimes)),
  };
}

// A genuine zero-duration Item — an explicit start date equal to its due
// date — renders as a milestone marker instead of a bar (spec section 4).
// An Item with no start date at all isn't a milestone; it renders as a
// single-day bar (dayOffset positions it using dueDate as both edges).
export function isMilestoneItem(item: TimelineItem): boolean {
  return item.startDate !== null && item.startDate.getTime() === item.dueDate.getTime();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Item due/start dates are stored as UTC midnight — day math compares UTC
// calendar days so it lands the same regardless of the server's local
// timezone, same convention as lib/calendar/month-grid.ts.
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Whole UTC calendar days between two dates (can be negative) — how many
// day columns a bar/marker sits from the grid's first column.
export function dayOffset(date: Date, from: Date): number {
  return Math.round((startOfDayUTC(date).getTime() - startOfDayUTC(from).getTime()) / MS_PER_DAY);
}

// Item date ranges only cover Items that happen to have dates near each
// other — padding keeps bars from butting against the grid's edge, and
// widening to include today keeps the Today marker always on-grid.
const RANGE_PADDING_DAYS = 3;

export function buildTimelineDayRange(range: TimelineDateRange, today: Date): TimelineDateRange {
  const paddedStart = new Date(startOfDayUTC(range.start).getTime() - RANGE_PADDING_DAYS * MS_PER_DAY);
  const paddedEnd = new Date(startOfDayUTC(range.end).getTime() + RANGE_PADDING_DAYS * MS_PER_DAY);
  const todayStart = startOfDayUTC(today);
  return {
    start: paddedStart.getTime() < todayStart.getTime() ? paddedStart : todayStart,
    end: paddedEnd.getTime() > todayStart.getTime() ? paddedEnd : todayStart,
  };
}

export function buildTimelineDays(dayRange: TimelineDateRange): Date[] {
  const days: Date[] = [];
  for (let time = dayRange.start.getTime(); time <= dayRange.end.getTime(); time += MS_PER_DAY) {
    days.push(new Date(time));
  }
  return days;
}

export type TimelineWeekGroup = { start: Date; end: Date; dayCount: number };

// Groups a contiguous run of day columns into calendar weeks (Sun–Sat) for
// the date header's top row (spec section 2) — the week at either edge of
// the range may be partial.
export function groupDaysByWeek(days: Date[]): TimelineWeekGroup[] {
  const groups: TimelineWeekGroup[] = [];
  for (const day of days) {
    const currentGroup = groups.at(-1);
    if (currentGroup && day.getUTCDay() !== 0) {
      currentGroup.end = day;
      currentGroup.dayCount += 1;
      continue;
    }
    groups.push({ start: day, end: day, dayCount: 1 });
  }
  return groups;
}

export type TimelineGroup = { sectionId: string | null; sectionName: string; items: TimelineItem[] };

const NO_SECTION_NAME = "No Section";

// Groups Timeline Items under their List Section, in Section order, with a
// trailing "No Section" bucket — mirrors the List/Board views' own Section
// grouping (page-data.ts's sections/unsectionedItems split) rather than
// inventing a second one. A List that doesn't use Sections collapses to a
// single unsectioned group, which the Timeline view then renders as a flat
// list instead of one lone group header.
export function groupTimelineItems(
  items: TimelineItem[],
  sections: { id: string; name: string }[]
): TimelineGroup[] {
  const itemsBySectionId = new Map<string, TimelineItem[]>();
  const unsectionedItems: TimelineItem[] = [];
  for (const item of items) {
    if (item.sectionId === null) {
      unsectionedItems.push(item);
      continue;
    }
    const bucket = itemsBySectionId.get(item.sectionId) ?? [];
    bucket.push(item);
    itemsBySectionId.set(item.sectionId, bucket);
  }

  const groups: TimelineGroup[] = sections
    .map((section) => ({
      sectionId: section.id,
      sectionName: section.name,
      items: itemsBySectionId.get(section.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);

  if (unsectionedItems.length > 0) {
    groups.push({ sectionId: null, sectionName: NO_SECTION_NAME, items: unsectionedItems });
  }

  return groups;
}
