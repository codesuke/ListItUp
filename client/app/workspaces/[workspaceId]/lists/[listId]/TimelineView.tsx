import {
  buildTimelineDayRange,
  buildTimelineDays,
  dayOffset,
  getTimelineDateRange,
  groupDaysByWeek,
  groupTimelineItems,
  isMilestoneItem,
  type TimelineItem,
} from "@/lib/list/list-timeline";

import { TimelineGrid, type TimelineGridGroup, type TimelineGridWeek } from "./TimelineGrid";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function itemDateLabel(item: TimelineItem): string {
  const barStart = item.startDate ?? item.dueDate;
  return barStart.getTime() === item.dueDate.getTime()
    ? formatShortDate(item.dueDate)
    : `${formatShortDate(barStart)} – ${formatShortDate(item.dueDate)}`;
}

function toGridGroup(
  group: { sectionId: string | null; sectionName: string; items: TimelineItem[] },
  dayRangeStart: Date,
  workspaceId: string,
  listId: string
): TimelineGridGroup {
  return {
    sectionId: group.sectionId,
    sectionName: group.sectionName,
    items: group.items.map((item) => {
      const barStart = item.startDate ?? item.dueDate;
      return {
        id: item.id,
        title: item.title,
        state: item.state,
        hasParent: item.hasParent,
        href: `/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`,
        assignees: item.assignees,
        startDayIndex: dayOffset(barStart, dayRangeStart),
        endDayIndex: dayOffset(item.dueDate, dayRangeStart),
        isMilestone: isMilestoneItem(item),
        dateLabel: itemDateLabel(item),
      };
    }),
  };
}

export function TimelineView({
  items,
  sections,
  workspaceId,
  listId,
  now,
}: {
  items: TimelineItem[];
  sections: { id: string; name: string }[];
  workspaceId: string;
  listId: string;
  now: Date;
}) {
  const itemRange = getTimelineDateRange(items);

  if (!itemRange) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
        No Items with a due date yet.
      </div>
    );
  }

  const dayRange = buildTimelineDayRange(itemRange, now);
  const days = buildTimelineDays(dayRange);
  const weeks: TimelineGridWeek[] = groupDaysByWeek(days).map((week) => ({
    label: `${formatShortDate(week.start)} – ${formatShortDate(week.end)}`,
    dayCount: week.dayCount,
  }));
  const rawGroups = groupTimelineItems(items, sections);
  const isFlatList = rawGroups.length === 1 && rawGroups[0]!.sectionId === null;
  const groups = rawGroups.map((group) => toGridGroup(group, dayRange.start, workspaceId, listId));
  const assigneeOptions = Array.from(
    new Map(items.flatMap((item) => item.assignees).map((assignee) => [assignee.userId, assignee])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <TimelineGrid
      days={days.map((date) => ({
        dayNumber: date.getUTCDate(),
        weekdayLabel: WEEKDAY_LABELS[date.getUTCDay()]!,
        shortLabel: formatShortDate(date),
        year: date.getUTCFullYear(),
      }))}
      weeks={weeks}
      todayDayIndex={dayOffset(now, dayRange.start)}
      groups={groups}
      isFlatList={isFlatList}
      assigneeOptions={assigneeOptions}
    />
  );
}
