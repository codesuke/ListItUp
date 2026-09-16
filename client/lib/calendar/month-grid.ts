const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Grid cell keys and Item due dates are compared by UTC calendar day so a
// midnight-UTC dueDate lands in the same cell regardless of the server's
// local timezone.
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type MonthGridCell<T> = {
  date: Date;
  inCurrentMonth: boolean;
  items: T[];
};

// Places Items on the day of their due date; Items with no due date are
// excluded entirely (the Timeline view's #33 precedent). Pure — the
// grid-building/day-bucketing shape is unit tested directly without a
// database. `monthStart` must be UTC-midnight on the 1st of the month
// being viewed.
//
// Shared by every Calendar surface (My Tasks #43, a List's own #32) since
// the month-grid math itself doesn't depend on what an "Item" looks like
// beyond its due date — only the query that produces the Item list differs
// per surface.
export function buildMonthGrid<T extends { dueDate: Date | null }>(
  items: T[],
  monthStart: Date
): MonthGridCell<T>[] {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();

  const itemsByDay = new Map<string, T[]>();
  for (const item of items) {
    if (!item.dueDate) continue;
    const key = toDateKey(item.dueDate);
    const bucket = itemsByDay.get(key) ?? [];
    bucket.push(item);
    itemsByDay.set(key, bucket);
  }

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const gridStart = new Date(firstOfMonth.getTime() - firstOfMonth.getUTCDay() * MS_PER_DAY);

  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const gridEnd = new Date(lastOfMonth.getTime() + (6 - lastOfMonth.getUTCDay()) * MS_PER_DAY);

  const cells: MonthGridCell<T>[] = [];
  for (let time = gridStart.getTime(); time <= gridEnd.getTime(); time += MS_PER_DAY) {
    const date = new Date(time);
    cells.push({
      date,
      inCurrentMonth: date.getUTCMonth() === month,
      items: itemsByDay.get(toDateKey(date)) ?? [],
    });
  }
  return cells;
}

// Parses a Calendar tab's `?month=YYYY-MM` query param into a UTC
// month-start Date, falling back to the current month for anything
// missing or malformed.
export function parseCalendarMonth(value: string | undefined, now: Date): Date {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return new Date(Date.UTC(year, monthIndex, 1));
}

export function formatCalendarMonthParam(monthStart: Date): string {
  const month = String(monthStart.getUTCMonth() + 1).padStart(2, "0");
  return `${monthStart.getUTCFullYear()}-${month}`;
}

export function addCalendarMonths(monthStart: Date, delta: number): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + delta, 1));
}
