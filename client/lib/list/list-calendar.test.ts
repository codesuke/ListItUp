import assert from "node:assert/strict";

import { calendarChipTone } from "./list-calendar";

const now = new Date("2026-09-16T12:00:00.000Z");

// Blocked always reads as "amber" regardless of due date, even an overdue
// one — Blocked is the more actionable signal on a List's Calendar (#32).
assert.equal(calendarChipTone({ state: "BLOCKED", dueDate: null }, now), "amber");
assert.equal(
  calendarChipTone({ state: "BLOCKED", dueDate: new Date("2026-09-01T00:00:00.000Z") }, now),
  "amber"
);

assert.equal(
  calendarChipTone({ state: "TO_DO", dueDate: new Date("2026-09-01T00:00:00.000Z") }, now),
  "red"
);

// A Complete Item is never "overdue" even with a past due date.
assert.equal(
  calendarChipTone({ state: "COMPLETE", dueDate: new Date("2026-09-01T00:00:00.000Z") }, now),
  "muted"
);

assert.equal(
  calendarChipTone({ state: "TO_DO", dueDate: new Date("2026-09-20T00:00:00.000Z") }, now),
  "muted"
);
assert.equal(calendarChipTone({ state: "IN_PROGRESS", dueDate: null }, now), "muted");

console.log("list calendar test passed");
