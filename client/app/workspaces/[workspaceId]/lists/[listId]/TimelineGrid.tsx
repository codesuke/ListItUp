"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import type { ItemState } from "@/generated/prisma/client";
import { STATE_BAR_TEXT, STATE_LABEL, statusColor, STATUS_ORDER } from "@/lib/list/list-timeline";

export type TimelineGridDay = { dayNumber: number; weekdayLabel: string; shortLabel: string; year: number };
export type TimelineGridWeek = { label: string; dayCount: number };

export type TimelineGridItem = {
  id: string;
  title: string;
  state: ItemState;
  hasParent: boolean;
  href: string;
  assignees: { userId: string; name: string }[];
  startDayIndex: number;
  endDayIndex: number;
  isMilestone: boolean;
  dateLabel: string;
};

export type TimelineGridGroup = {
  sectionId: string | null;
  sectionName: string;
  items: TimelineGridItem[];
};

type ViewMode = "day" | "week" | "month";

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

// Day/Week/Month only changes the day-column width (zoom density) — the
// header's week grouping and the set of days rendered stay the same, per
// the spec's section 2. Month is floored at the spec's minimum column
// width so day labels never clip.
const COLUMN_WIDTH: Record<ViewMode, number> = { day: 120, week: 88, month: 64 };

const LEFT_COLUMN_WIDTH = 268;
const TASK_ROW_HEIGHT = 46;
const GROUP_ROW_HEIGHT = 36;
const HEADER_WEEK_ROW_HEIGHT = 26;
const HEADER_DAY_ROW_HEIGHT = 40;
const BAR_HEIGHT = 26;
const MILESTONE_SIZE = 16;
// Below this bar width, the task name is dropped in favor of a native
// tooltip rather than clipping to an unreadable sliver of text.
const MIN_LABEL_BAR_WIDTH = 44;
const TODAY_MARKER_COLOR = "#f2545b";

type BodyRow =
  | { kind: "group"; key: string; sectionName: string; taskCount: number; height: number }
  | { kind: "task"; key: string; item: TimelineGridItem; height: number };

function matchesFilters(item: TimelineGridItem, statusFilter: string, assigneeFilter: string): boolean {
  const matchesStatus = statusFilter === "all" || item.state === statusFilter;
  const matchesAssignee =
    assigneeFilter === "all" || item.assignees.some((assignee) => assignee.userId === assigneeFilter);
  return matchesStatus && matchesAssignee;
}

export function TimelineGrid({
  days,
  weeks,
  todayDayIndex,
  groups,
  isFlatList,
  assigneeOptions,
}: {
  days: TimelineGridDay[];
  weeks: TimelineGridWeek[];
  todayDayIndex: number;
  groups: TimelineGridGroup[];
  isFlatList: boolean;
  assigneeOptions: { userId: string; name: string }[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [visibleRange, setVisibleRange] = useState({ first: 0, count: 7 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnWidth = COLUMN_WIDTH[viewMode];

  const updateVisibleRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || days.length === 0) return;
    const first = Math.max(0, Math.min(days.length - 1, Math.floor(el.scrollLeft / columnWidth)));
    const viewportWidth = Math.max(el.clientWidth - LEFT_COLUMN_WIDTH, columnWidth);
    const count = Math.max(1, Math.floor(viewportWidth / columnWidth));
    setVisibleRange({ first, count });
  }, [columnWidth, days.length]);

  // Anchor the viewport a couple of days before today whenever the day
  // range or column width (Day/Week/Month) changes, including on mount.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const anchorIndex = Math.max(0, todayDayIndex - 2);
    el.scrollLeft = anchorIndex * columnWidth;
    updateVisibleRange();
  }, [columnWidth, todayDayIndex, updateVisibleRange]);

  useEffect(() => {
    window.addEventListener("resize", updateVisibleRange);
    return () => window.removeEventListener("resize", updateVisibleRange);
  }, [updateVisibleRange]);

  function scrollByPage(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * visibleRange.count * columnWidth, behavior: "smooth" });
  }

  const filteredGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => matchesFilters(item, statusFilter, assigneeFilter)) }))
    .filter((group) => group.items.length > 0);

  const rows: BodyRow[] = isFlatList
    ? filteredGroups.flatMap((group) =>
        group.items.map((item) => ({ kind: "task" as const, key: item.id, item, height: TASK_ROW_HEIGHT }))
      )
    : filteredGroups.flatMap((group) => [
        {
          kind: "group" as const,
          key: group.sectionId ?? "no-section",
          sectionName: group.sectionName,
          taskCount: group.items.length,
          height: GROUP_ROW_HEIGHT,
        },
        ...group.items.map((item) => ({ kind: "task" as const, key: item.id, item, height: TASK_ROW_HEIGHT })),
      ]);

  const lastVisibleIndex = Math.min(days.length - 1, visibleRange.first + visibleRange.count - 1);
  const startDay = days[visibleRange.first];
  const endDay = days[lastVisibleIndex];
  const visibleRangeLabel = startDay && endDay ? `${startDay.shortLabel} – ${endDay.shortLabel}, ${endDay.year}` : "";

  const weekPlacements = weeks.map((week, index) => ({
    ...week,
    colStart: 2 + weeks.slice(0, index).reduce((total, precedingWeek) => total + precedingWeek.dayCount, 0),
  }));

  const gridTemplateColumns = `${LEFT_COLUMN_WIDTH}px repeat(${days.length}, ${columnWidth}px)`;
  const gridTemplateRows = `${HEADER_WEEK_ROW_HEIGHT}px ${HEADER_DAY_ROW_HEIGHT}px ${rows
    .map((row) => `${row.height}px`)
    .join(" ")}`;
  const showsToday = todayDayIndex >= 0 && todayDayIndex < days.length;

  return (
    <div className="mt-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-ink">
            <CalendarIcon className="h-3.5 w-3.5 text-ink-muted" />
            {visibleRangeLabel}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Scroll to earlier dates"
              onClick={() => scrollByPage(-1)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Scroll to later dates"
              onClick={() => scrollByPage(1)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-[6px] border border-line-strong bg-surface-2 p-0.5">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setViewMode(mode.key)}
                className={
                  mode.key === viewMode
                    ? "rounded-[4px] bg-surface-4 px-2.5 py-1 text-[12px] font-semibold text-ink"
                    : "rounded-[4px] px-2.5 py-1 text-[12px] text-ink-muted transition-colors duration-150 hover:text-ink"
                }
              >
                {mode.label}
              </button>
            ))}
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-ink"
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((state) => (
              <option key={state} value={state}>
                {STATE_LABEL[state]}
              </option>
            ))}
          </select>
          {assigneeOptions.length > 0 && (
            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className="h-9 rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-ink"
            >
              <option value="all">All assignees</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.userId} value={assignee.userId}>
                  {assignee.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4">
          {STATUS_ORDER.map((state) => (
            <span key={state} className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor(state) }} />
              {STATE_LABEL[state]}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
          No Items match the current filters.
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={updateVisibleRange}
          className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-surface-1"
        >
          <div className="isolate grid" style={{ gridTemplateColumns, gridTemplateRows }}>
            <div
              className="sticky top-0 left-0 z-30 flex items-center border-b border-r border-line bg-surface-1 pl-4 text-[13px] font-semibold text-ink"
              style={{ gridColumn: 1, gridRow: "1 / 3" }}
            >
              Tasks
            </div>

            {weekPlacements.map((week) => (
              <div
                key={week.label}
                className="sticky top-0 z-20 flex items-center justify-center overflow-hidden border-b border-r border-line bg-surface-1 px-2"
                style={{ gridColumn: `${week.colStart} / span ${week.dayCount}`, gridRow: 1 }}
              >
                <span className="min-w-0 truncate text-[11px] text-ink-muted">{week.label}</span>
              </div>
            ))}

            {days.map((day, dayIndex) => {
              const isToday = dayIndex === todayDayIndex;
              return (
                <div
                  key={`${day.year}-${day.shortLabel}`}
                  className="sticky z-20 flex flex-col items-center justify-center border-b border-r border-line bg-surface-1"
                  style={{ gridColumn: dayIndex + 2, gridRow: 2, top: HEADER_WEEK_ROW_HEIGHT }}
                >
                  {isToday ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: TODAY_MARKER_COLOR }}
                    >
                      Today
                    </span>
                  ) : (
                    <>
                      <span className="text-[13px] font-semibold text-ink">{day.dayNumber}</span>
                      <span className="text-[10px] text-ink-faint">{day.weekdayLabel}</span>
                    </>
                  )}
                </div>
              );
            })}

            <div
              aria-hidden
              className="pointer-events-none"
              style={{
                gridColumn: `2 / span ${days.length}`,
                gridRow: `3 / span ${rows.length}`,
                backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${
                  columnWidth - 1
                }px, var(--line) ${columnWidth - 1}px, var(--line) ${columnWidth}px)`,
              }}
            />

            {showsToday && (
              <div
                aria-hidden
                className="pointer-events-none justify-self-start"
                style={{
                  gridColumn: todayDayIndex + 2,
                  gridRow: `3 / span ${rows.length}`,
                  width: 2,
                  backgroundColor: TODAY_MARKER_COLOR,
                }}
              />
            )}

            {rows.map((row, rowIndex) => {
              const gridRow = rowIndex + 3;

              if (row.kind === "group") {
                return (
                  <div
                    key={row.key}
                    className="sticky left-0 z-10 flex items-center justify-between border-b border-r border-line bg-surface-1 px-4 pt-3.5 pb-1.5"
                    style={{ gridColumn: 1, gridRow }}
                  >
                    <span className="truncate text-[12px] font-semibold text-ink">{row.sectionName}</span>
                    <span className="ml-2 flex-shrink-0 text-[11px] text-ink-faint">
                      {row.taskCount} {row.taskCount === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                );
              }

              const { item } = row;
              const barSpanDays = item.endDayIndex - item.startDayIndex + 1;
              const barWidthPx = barSpanDays * columnWidth;

              // Both calls go through the same statusColor() lookup — a
              // dev-only guard in case a future edit ever makes the dot and
              // the bar/diamond read from two different places again.
              const dotColor = statusColor(item.state);
              const barColor = statusColor(item.state);
              if (process.env.NODE_ENV !== "production" && dotColor !== barColor) {
                console.error(
                  `Timeline: dot/bar color mismatch for "${item.title}" (${item.id}, status ${item.state}): dot=${dotColor} bar=${barColor}`
                );
              }

              return (
                <Fragment key={row.key}>
                  <a
                    href={item.href}
                    className="sticky left-0 z-10 flex items-center gap-2.5 border-b border-r border-line bg-surface-1 px-4 text-sm text-ink transition-colors duration-150 hover:bg-surface-2"
                    style={{ gridColumn: 1, gridRow }}
                  >
                    <span
                      data-testid={`dot-${item.id}`}
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
                      {item.title}
                    </span>
                    {item.assignees[0] && (
                      <span className="flex-shrink-0" title={item.assignees.map((a) => a.name).join(", ")}>
                        <MemberAvatar name={item.assignees[0].name} />
                      </span>
                    )}
                  </a>

                  {item.isMilestone ? (
                    // Spans from the milestone's own day column all the way to
                    // the grid's right edge so the label has a bounded,
                    // truncating box to flow into instead of overflowing
                    // adjacent columns/rows unclipped.
                    <div
                      className="flex items-center gap-2 overflow-hidden border-b border-line"
                      style={{ gridColumn: `${item.startDayIndex + 2} / -1`, gridRow }}
                      title={`${item.title} — ${item.dateLabel}`}
                    >
                      <span
                        data-testid={`bar-${item.id}`}
                        className="flex-shrink-0 rounded-[3px]"
                        style={{
                          width: MILESTONE_SIZE,
                          height: MILESTONE_SIZE,
                          marginLeft: columnWidth / 2 - MILESTONE_SIZE / 2,
                          backgroundColor: barColor,
                          transform: "rotate(45deg)",
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{item.title}</span>
                    </div>
                  ) : (
                    <div
                      className="relative border-b border-line"
                      style={{ gridColumn: `${item.startDayIndex + 2} / ${item.endDayIndex + 3}`, gridRow }}
                    >
                      <a
                        href={item.href}
                        title={`${item.title} — ${item.dateLabel}`}
                        data-testid={`bar-${item.id}`}
                        className="absolute left-0.5 right-0.5 flex items-center gap-1.5 overflow-hidden rounded-[7px] px-2.5"
                        style={{
                          top: (TASK_ROW_HEIGHT - BAR_HEIGHT) / 2,
                          height: BAR_HEIGHT,
                          backgroundColor: barColor,
                          color: STATE_BAR_TEXT[item.state],
                        }}
                      >
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-70" />
                        {barWidthPx >= MIN_LABEL_BAR_WIDTH && (
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{item.title}</span>
                        )}
                      </a>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
