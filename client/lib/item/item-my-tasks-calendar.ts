import type { MyTaskItem } from "@/lib/item/item-my-tasks";
import { buildMonthGrid, type MonthGridCell } from "@/lib/calendar/month-grid";

export { addCalendarMonths, formatCalendarMonthParam, parseCalendarMonth } from "@/lib/calendar/month-grid";

export type MyTasksCalendarCell = MonthGridCell<MyTaskItem>;

// Places assigned Items on the day of their due date (#43) — the month-grid
// math itself lives in lib/calendar/month-grid.ts, shared with the List
// page's own Calendar (#32).
export function buildMyTasksCalendarGrid(items: MyTaskItem[], monthStart: Date): MyTasksCalendarCell[] {
  return buildMonthGrid(items, monthStart);
}
