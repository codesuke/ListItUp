import type { ItemState } from "@/generated/prisma/client";
import { isItemOverdue } from "@/lib/item/item-my-tasks";

export type CalendarChipTone = "red" | "amber" | "muted";

// The Calendar tab's per-day chips (#32) color-code by the same signals as
// the legend in design-mocks/calendar-view: Blocked wins over an overdue
// due date since it's the more actionable state to surface at a glance.
export function calendarChipTone(item: { state: ItemState; dueDate: Date | null }, now: Date): CalendarChipTone {
  if (item.state === "BLOCKED") return "amber";
  if (item.state !== "COMPLETE" && isItemOverdue(item, now)) return "red";
  return "muted";
}
