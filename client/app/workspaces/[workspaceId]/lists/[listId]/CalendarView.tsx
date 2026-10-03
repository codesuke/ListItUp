import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { calendarChipTone, type CalendarChipTone } from "@/lib/list/list-calendar";

import type { MonthGridCell } from "@/lib/calendar/month-grid";
import type { ItemSummary } from "./page-data";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_ITEMS_PER_DAY = 3;

const CHIP_DOT_COLOR: Record<CalendarChipTone, string> = {
  red: "#f2545b",
  amber: "#f5b642",
  muted: "#5a5a56",
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function CalendarView({
  cells,
  monthLabel,
  prevHref,
  nextHref,
  workspaceId,
  listId,
  now,
}: {
  cells: MonthGridCell<ItemSummary>[];
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  workspaceId: string;
  listId: string;
  now: Date;
}) {
  const todayKey = toDateKey(now);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={prevHref}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-ink">{monthLabel}</span>
        <Link
          href={nextHref}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[8px] border border-line bg-line">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-surface-1 py-2 text-center text-[11px] text-ink-muted">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const dateKey = toDateKey(cell.date);
          const isToday = dateKey === todayKey;
          return (
            <div
              key={dateKey}
              className={`flex min-h-[112px] flex-col gap-1 bg-surface-2 p-2 ${
                cell.inCurrentMonth ? "" : "opacity-40"
              } ${isToday ? "shadow-[inset_0_0_0_1.5px_#ff6b4a]" : ""}`}
            >
              <span className={`text-[11px] ${isToday ? "font-semibold text-[#ff8a70]" : "text-ink-muted"}`}>
                {cell.date.getUTCDate()}
              </span>
              {cell.items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY).map((item) => (
                <Link
                  key={item.id}
                  href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
                  className="flex items-center gap-1.5 truncate rounded-[5px] bg-surface-3 px-1.5 py-1 text-[11px] text-ink-muted transition-colors duration-150 hover:text-ink"
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: CHIP_DOT_COLOR[calendarChipTone(item, now)] }}
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              ))}
              {cell.items.length > MAX_VISIBLE_ITEMS_PER_DAY && (
                <span className="text-[11px] text-ink-muted">
                  +{cell.items.length - MAX_VISIBLE_ITEMS_PER_DAY} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHIP_DOT_COLOR.red }} /> Overdue
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHIP_DOT_COLOR.amber }} /> Blocked
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHIP_DOT_COLOR.muted }} /> Scheduled
        </span>
      </div>
    </div>
  );
}
