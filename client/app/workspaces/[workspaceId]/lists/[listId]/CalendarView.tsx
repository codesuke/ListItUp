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
    <div className="mt-2">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            aria-label="Previous month"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-[#333333] bg-[#141414] text-[#8f8f8a] hover:bg-[#1a1a1a] hover:text-[#e5e5e0]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="text-[15px] font-semibold text-[#e5e5e0]">{monthLabel}</span>
          <Link
            href={nextHref}
            aria-label="Next month"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-[#333333] bg-[#141414] text-[#8f8f8a] hover:bg-[#1a1a1a] hover:text-[#e5e5e0]"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[12px] border border-[#232323] bg-[#232323]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-[#0d0d0d] py-2 text-center font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.1em] text-[#5a5a56]"
          >
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const dateKey = toDateKey(cell.date);
          const isToday = dateKey === todayKey;
          return (
            <div
              key={dateKey}
              className={`flex min-h-[112px] flex-col gap-1 bg-[#141414] p-2 ${
                cell.inCurrentMonth ? "" : "opacity-40"
              } ${isToday ? "shadow-[inset_0_0_0_1.5px_#ff6b4a]" : ""}`}
            >
              <span
                className={`text-[11px] ${
                  isToday ? "font-semibold text-[#ff8a70]" : "text-[#5a5a56]"
                }`}
              >
                {cell.date.getUTCDate()}
              </span>
              {cell.items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY).map((item) => (
                <Link
                  key={item.id}
                  href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
                  className="flex items-center gap-1.5 truncate rounded-[5px] bg-[#1a1a1a] px-1.5 py-1 text-[11px] text-[#8f8f8a] hover:text-[#e5e5e0]"
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: CHIP_DOT_COLOR[calendarChipTone(item, now)] }}
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              ))}
              {cell.items.length > MAX_VISIBLE_ITEMS_PER_DAY && (
                <span className="text-[11px] text-[#5a5a56]">
                  +{cell.items.length - MAX_VISIBLE_ITEMS_PER_DAY} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] text-[#5a5a56]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHIP_DOT_COLOR.red }} /> Overdue
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#5a5a56]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHIP_DOT_COLOR.amber }} /> Blocked
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#5a5a56]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHIP_DOT_COLOR.muted }} /> Scheduled
        </span>
      </div>
    </div>
  );
}
