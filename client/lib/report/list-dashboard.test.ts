import assert from "node:assert/strict";

import {
  breakdownBySection,
  breakdownByState,
  buildAttentionImbalance,
  buildCompletionHeatmap,
  buildCompletionOverTime,
  buildContributionMap,
  buildPersonalContributionByList,
  computeItemCounts,
  computeProgressPercent,
} from "./list-dashboard";

function item(overrides: {
  state: "TO_DO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
  dueDate?: Date | null;
  sectionId?: string | null;
  updatedAt?: Date;
}) {
  return {
    state: overrides.state,
    dueDate: overrides.dueDate ?? null,
    sectionId: overrides.sectionId ?? null,
    updatedAt: overrides.updatedAt ?? new Date("2026-09-01T00:00:00.000Z"),
  };
}

const NOW = new Date("2026-09-15T12:00:00.000Z");

// computeItemCounts: Incomplete is everything not Complete (To Do,
// In Progress, and Blocked all count), and Overdue only counts Items with
// a past due date that aren't already Complete.
{
  const items = [
    item({ state: "COMPLETE", dueDate: new Date("2026-09-01") }),
    item({ state: "TO_DO", dueDate: new Date("2026-09-10") }), // overdue
    item({ state: "IN_PROGRESS", dueDate: new Date("2026-09-20") }), // not yet due
    item({ state: "BLOCKED", dueDate: null }),
    // Complete but with a past due date doesn't count as overdue.
    item({ state: "COMPLETE", dueDate: new Date("2026-09-05") }),
  ];
  const counts = computeItemCounts(items, NOW);
  assert.deepEqual(counts, { total: 5, completed: 2, incomplete: 3, overdue: 1 });
}

{
  const counts = computeItemCounts([], NOW);
  assert.deepEqual(counts, { total: 0, completed: 0, incomplete: 0, overdue: 0 });
}

// breakdownBySection: one entry per Section in the order given, plus a
// trailing "No Section" entry only when unsectioned Items exist.
{
  const sections = [
    { id: "backlog", name: "Backlog" },
    { id: "done", name: "Done" },
  ];
  const items = [
    item({ state: "TO_DO", sectionId: "backlog" }),
    item({ state: "TO_DO", sectionId: "backlog" }),
    item({ state: "COMPLETE", sectionId: "done" }),
    item({ state: "TO_DO", sectionId: null }),
  ];
  assert.deepEqual(breakdownBySection(items, sections), [
    { sectionId: "backlog", sectionName: "Backlog", count: 2 },
    { sectionId: "done", sectionName: "Done", count: 1 },
    { sectionId: null, sectionName: "No Section", count: 1 },
  ]);
}

{
  const sections = [{ id: "backlog", name: "Backlog" }];
  const items = [item({ state: "TO_DO", sectionId: "backlog" })];
  assert.deepEqual(
    breakdownBySection(items, sections),
    [{ sectionId: "backlog", sectionName: "Backlog", count: 1 }],
    "no unsectioned entry when there are no unsectioned Items"
  );
}

// breakdownByState: fixed state order, zero-count states still present.
{
  const items = [
    item({ state: "COMPLETE" }),
    item({ state: "COMPLETE" }),
    item({ state: "TO_DO" }),
  ];
  assert.deepEqual(breakdownByState(items), [
    { state: "TO_DO", label: "To Do", count: 1 },
    { state: "IN_PROGRESS", label: "In Progress", count: 0 },
    { state: "BLOCKED", label: "Blocked", count: 0 },
    { state: "COMPLETE", label: "Complete", count: 2 },
  ]);
}

// buildCompletionOverTime: one point per day across the trailing window,
// a running cumulative total of Complete Items (approximated by
// updatedAt, the closest thing Item has to a completion timestamp),
// carrying forward completions from before the window starts.
{
  // Window is [Sept 11, Sept 15] (5 days ending "today"). Sept 1 falls
  // before it and is folded into the day-11 starting cumulative total.
  const items = [
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-01T08:00:00.000Z") }), // before window
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-11T08:00:00.000Z") }),
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-13T08:00:00.000Z") }),
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-13T20:00:00.000Z") }), // same day, second one
    item({ state: "TO_DO", updatedAt: new Date("2026-09-12T08:00:00.000Z") }), // not Complete, ignored
  ];
  const points = buildCompletionOverTime(items, NOW, 5);
  assert.deepEqual(points, [
    { date: "2026-09-11", cumulativeCompleted: 2 },
    { date: "2026-09-12", cumulativeCompleted: 2 },
    { date: "2026-09-13", cumulativeCompleted: 4 },
    { date: "2026-09-14", cumulativeCompleted: 4 },
    { date: "2026-09-15", cumulativeCompleted: 4 },
  ]);
}

{
  const points = buildCompletionOverTime([], NOW, 3);
  assert.deepEqual(points, [
    { date: "2026-09-13", cumulativeCompleted: 0 },
    { date: "2026-09-14", cumulativeCompleted: 0 },
    { date: "2026-09-15", cumulativeCompleted: 0 },
  ]);
}

// computeProgressPercent: share of active Items that are Complete, 0 on
// an empty List rather than dividing by zero.
{
  assert.equal(computeProgressPercent({ total: 4, completed: 3, incomplete: 1, overdue: 0 }), 75);
  assert.equal(computeProgressPercent({ total: 0, completed: 0, incomplete: 0, overdue: 0 }), 0);
}

// buildCompletionHeatmap: one column per week, 7 cells per column, oldest
// day first; intensity is bucketed relative to the window's busiest day,
// and an all-zero window buckets everything to 0 rather than dividing by
// zero.
{
  const items = [
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-15T08:00:00.000Z") }), // today, busiest day (2)
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-15T20:00:00.000Z") }),
    item({ state: "COMPLETE", updatedAt: new Date("2026-09-09T08:00:00.000Z") }), // 1 completion
    item({ state: "TO_DO", updatedAt: new Date("2026-09-14T08:00:00.000Z") }), // not Complete, ignored
  ];
  const weeks = buildCompletionHeatmap(items, NOW, 2);

  assert.equal(weeks.length, 2);
  assert.equal(weeks[0]!.length, 7);
  assert.equal(weeks[0]![0]!.date, "2026-09-02");
  assert.equal(weeks[1]![6]!.date, "2026-09-15");

  const sept9 = weeks[1]!.find((cell) => cell.date === "2026-09-09")!;
  assert.deepEqual(sept9, { date: "2026-09-09", count: 1, intensity: 2 });

  const sept15 = weeks[1]!.find((cell) => cell.date === "2026-09-15")!;
  assert.deepEqual(sept15, { date: "2026-09-15", count: 2, intensity: 4 });

  const sept3 = weeks[0]!.find((cell) => cell.date === "2026-09-03")!;
  assert.deepEqual(sept3, { date: "2026-09-03", count: 0, intensity: 0 });
}

{
  const weeks = buildCompletionHeatmap([], NOW, 1);
  assert.ok(weeks[0]!.every((cell) => cell.intensity === 0));
}

function assignedItem(overrides: {
  state: "TO_DO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
  dueDate?: Date | null;
  assigneeUserIds: string[];
}) {
  return {
    state: overrides.state,
    dueDate: overrides.dueDate ?? null,
    assigneeUserIds: overrides.assigneeUserIds,
  };
}

// buildContributionMap: a normalized completion rate, not a raw count —
// a Member with fewer assigned Items but a higher completion rate ranks
// above one with more assigned but a lower rate. Members with zero
// assigned Items are excluded entirely, not shown at 0%.
{
  const members = [
    { userId: "riya", name: "Riya Kapoor" },
    { userId: "maya", name: "Maya Torres" },
    { userId: "idle", name: "Idle Member" },
  ];
  const items = [
    assignedItem({ state: "COMPLETE", assigneeUserIds: ["riya"] }),
    assignedItem({ state: "COMPLETE", assigneeUserIds: ["riya"] }),
    assignedItem({ state: "TO_DO", assigneeUserIds: ["riya"] }),
    assignedItem({ state: "COMPLETE", assigneeUserIds: ["maya"] }),
    assignedItem({ state: "TO_DO", assigneeUserIds: ["maya"] }),
    assignedItem({ state: "TO_DO", assigneeUserIds: ["maya"] }),
  ];

  assert.deepEqual(buildContributionMap(items, members), [
    { userId: "riya", name: "Riya Kapoor", completionRatePercent: 67 },
    { userId: "maya", name: "Maya Torres", completionRatePercent: 33 },
  ]);
}

// buildPersonalContributionByList: My Tasks' personal-only analog of
// buildContributionMap, broken down per source List instead of per Member
// (#50). The fixture gives "Marketing" 20 raw assigned Items (5 completed)
// and "Personal Space" only 2 (both completed) — a raw-count-proportional
// chart would rank Marketing above Personal Space, but the normalized
// completion rate ranks Personal Space's 100% ahead of Marketing's 25%,
// proving the returned metric is a rate, not proportional to raw count.
{
  const marketingItems = Array.from({ length: 20 }, (_, index) => ({
    listId: "marketing",
    listName: "Marketing List",
    state: index < 5 ? ("COMPLETE" as const) : ("TO_DO" as const),
  }));
  const personalItems = [
    { listId: "personal", listName: "Personal Space List", state: "COMPLETE" as const },
    { listId: "personal", listName: "Personal Space List", state: "COMPLETE" as const },
  ];

  assert.deepEqual(buildPersonalContributionByList([...marketingItems, ...personalItems]), [
    { listId: "personal", label: "Personal Space List", completionRatePercent: 100 },
    { listId: "marketing", label: "Marketing List", completionRatePercent: 25 },
  ]);
}

// buildAttentionImbalance: each axis is normalized against its own busiest
// Member (0..1) — Riya has the most Blocked Items so she reaches 1 on that
// axis; Maya's 1 Blocked Item out of Riya's 2 normalizes to 0.5. A Member
// with no assigned Items is excluded.
{
  const members = [
    { userId: "riya", name: "Riya Kapoor" },
    { userId: "maya", name: "Maya Torres" },
    { userId: "idle", name: "Idle Member" },
  ];
  const items = [
    assignedItem({ state: "BLOCKED", assigneeUserIds: ["riya"] }),
    assignedItem({ state: "BLOCKED", assigneeUserIds: ["riya"] }),
    assignedItem({ state: "BLOCKED", assigneeUserIds: ["maya"] }),
    assignedItem({ state: "TO_DO", dueDate: new Date("2026-09-01"), assigneeUserIds: ["maya"] }), // overdue
    assignedItem({ state: "COMPLETE", assigneeUserIds: ["maya"] }),
  ];

  assert.deepEqual(buildAttentionImbalance(items, members, NOW), [
    { userId: "riya", name: "Riya Kapoor", normalized: { TO_DO: 0, BLOCKED: 1, OVERDUE: 0, DONE: 0 } },
    { userId: "maya", name: "Maya Torres", normalized: { TO_DO: 1, BLOCKED: 0.5, OVERDUE: 1, DONE: 1 } },
  ]);
}

console.log("list dashboard test passed");
