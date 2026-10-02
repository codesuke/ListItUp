import { ChevronLeft, ChevronRight } from "lucide-react";

import { myTaskItemHref } from "@/lib/item/item-my-tasks";
import type { MyTasksCalendarCell } from "@/lib/item/item-my-tasks-calendar";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_ITEMS_PER_DAY = 3;

export function CalendarView({
  cells,
  monthLabel,
  prevHref,
  nextHref,
}: {
  cells: MyTasksCalendarCell[];
  monthLabel: string;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <a
          href={prevHref}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>
        <span className="text-sm font-medium text-ink">{monthLabel}</span>
        <a
          href={nextHref}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-lg border border-line bg-surface-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-surface-1 px-2 py-1 text-center text-[11px] text-ink-muted">
              {label}
            </div>
          ))}
          {cells.map((cell) => (
            <div
              key={cell.date.toISOString()}
              className={`min-h-24 bg-surface-1 p-1.5 ${cell.inCurrentMonth ? "" : "opacity-40"}`}
            >
              <div className="text-[10px] text-ink-muted">{cell.date.getUTCDate()}</div>
              <div className="mt-1 flex flex-col gap-1">
                {cell.items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY).map((item) => (
                  <a
                    key={item.id}
                    href={myTaskItemHref(item, item.id)}
                    className="truncate rounded bg-surface-2 px-1 py-0.5 text-[10px] text-ink hover:text-ink hover:underline"
                  >
                    {item.title}
                  </a>
                ))}
                {cell.items.length > MAX_VISIBLE_ITEMS_PER_DAY && (
                  <span className="text-[10px] text-ink-muted">
                    +{cell.items.length - MAX_VISIBLE_ITEMS_PER_DAY} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
