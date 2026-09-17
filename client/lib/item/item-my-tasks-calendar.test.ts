import assert from "node:assert/strict";

import {
  addCalendarMonths,
  buildMyTasksCalendarGrid,
  formatCalendarMonthParam,
  parseCalendarMonth,
} from "./item-my-tasks-calendar";
import type { MyTaskItem } from "./item-my-tasks";

function item(overrides: Partial<MyTaskItem> & Pick<MyTaskItem, "id">): MyTaskItem {
  return {
    title: "Item",
    state: "TO_DO",
    priority: "NORMAL",
    dueDate: null,
    hasParent: false,
    listId: "list-1",
    listName: "List",
    sourceWorkspaceId: "ws-1",
    sourceWorkspaceName: "Marketing",
    sourceWorkspaceKind: "SHARED",
    blockerReason: null,
    attachments: [],
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

// September 2026 starts on a Tuesday — the grid should pad back to Sunday
// Aug 30 and forward to Saturday Oct 3, and place each Item on its due
// date's cell. Items with no due date are excluded entirely.
{
  const monthStart = new Date("2026-09-01T00:00:00.000Z");
  const items: MyTaskItem[] = [
    item({ id: "a", dueDate: new Date("2026-09-01T00:00:00.000Z") }),
    item({ id: "b", dueDate: new Date("2026-09-15T00:00:00.000Z") }),
    item({ id: "c", dueDate: new Date("2026-09-15T00:00:00.000Z") }),
    item({ id: "d", dueDate: new Date("2026-08-31T00:00:00.000Z") }),
    item({ id: "e", dueDate: null }),
  ];

  const cells = buildMyTasksCalendarGrid(items, monthStart);

  assert.equal(cells[0].date.toISOString().slice(0, 10), "2026-08-30");
  assert.equal(cells[cells.length - 1].date.toISOString().slice(0, 10), "2026-10-03");
  assert.equal(cells.length % 7, 0);

  const sep1 = cells.find((cell) => cell.date.toISOString().slice(0, 10) === "2026-09-01")!;
  assert.deepEqual(sep1.items.map((i) => i.id), ["a"]);
  assert.equal(sep1.inCurrentMonth, true);

  const sep15 = cells.find((cell) => cell.date.toISOString().slice(0, 10) === "2026-09-15")!;
  assert.deepEqual(sep15.items.map((i) => i.id), ["b", "c"]);

  const aug31 = cells.find((cell) => cell.date.toISOString().slice(0, 10) === "2026-08-31")!;
  assert.deepEqual(aug31.items.map((i) => i.id), ["d"]);
  assert.equal(aug31.inCurrentMonth, false);

  const allItemIds = cells.flatMap((cell) => cell.items.map((i) => i.id));
  assert.equal(allItemIds.includes("e"), false);
}

// parseCalendarMonth / formatCalendarMonthParam / addCalendarMonths
{
  const now = new Date("2026-09-15T12:00:00.000Z");
  assert.equal(parseCalendarMonth("2026-11", now).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(parseCalendarMonth(undefined, now).toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(parseCalendarMonth("garbage", now).toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(parseCalendarMonth("2026-13", now).toISOString(), "2026-09-01T00:00:00.000Z");

  const november = new Date("2026-11-01T00:00:00.000Z");
  assert.equal(formatCalendarMonthParam(november), "2026-11");
  assert.equal(formatCalendarMonthParam(addCalendarMonths(november, 1)), "2026-12");
  assert.equal(formatCalendarMonthParam(addCalendarMonths(november, -11)), "2025-12");
}

console.log("item my-tasks calendar test passed");
