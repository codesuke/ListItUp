import assert from "node:assert/strict";

import {
  buildTimelineDayRange,
  buildTimelineDays,
  buildTimelineItems,
  dayOffset,
  getTimelineDateRange,
  groupDaysByWeek,
  groupTimelineItems,
  isMilestoneItem,
} from "./list-timeline";

function candidate(overrides: {
  id: string;
  startDate?: Date | null;
  dueDate: Date | null;
  sectionId?: string | null;
  assignees?: { userId: string; name: string }[];
}) {
  return {
    id: overrides.id,
    title: `Item ${overrides.id}`,
    state: "TO_DO" as const,
    priority: "NORMAL" as const,
    hasParent: false,
    sectionId: overrides.sectionId ?? null,
    assignees: overrides.assignees ?? [],
    startDate: overrides.startDate ?? null,
    dueDate: overrides.dueDate,
  };
}

// Items with no due date are excluded entirely — a bar needs at least an
// end date to draw.
{
  const items = [
    candidate({ id: "no-due-date", dueDate: null }),
    candidate({ id: "has-due-date", dueDate: new Date("2026-10-05") }),
  ];
  const bars = buildTimelineItems(items);
  assert.deepEqual(
    bars.map((b) => b.id),
    ["has-due-date"]
  );
}

// startDate carries through when present, and is null when absent.
{
  const items = [
    candidate({ id: "with-start", startDate: new Date("2026-10-01"), dueDate: new Date("2026-10-05") }),
    candidate({ id: "without-start", dueDate: new Date("2026-10-03") }),
  ];
  const bars = buildTimelineItems(items);
  const withStart = bars.find((b) => b.id === "with-start")!;
  const withoutStart = bars.find((b) => b.id === "without-start")!;
  assert.equal(withStart.startDate?.toISOString(), new Date("2026-10-01").toISOString());
  assert.equal(withoutStart.startDate, null);
}

// Bars sort by due date, earliest first.
{
  const items = [
    candidate({ id: "later", dueDate: new Date("2026-11-01") }),
    candidate({ id: "earlier", dueDate: new Date("2026-10-01") }),
    candidate({ id: "middle", dueDate: new Date("2026-10-15") }),
  ];
  const bars = buildTimelineItems(items);
  assert.deepEqual(
    bars.map((b) => b.id),
    ["earlier", "middle", "later"]
  );
}

// getTimelineDateRange: null for an empty set, otherwise the earliest
// bar-start (startDate if present, else dueDate) through the latest due
// date.
{
  assert.equal(getTimelineDateRange([]), null);

  const items = buildTimelineItems([
    candidate({ id: "a", startDate: new Date("2026-10-01"), dueDate: new Date("2026-10-10") }),
    candidate({ id: "b", dueDate: new Date("2026-10-20") }),
  ]);
  const range = getTimelineDateRange(items);
  assert.equal(range?.start.toISOString(), new Date("2026-10-01").toISOString());
  assert.equal(range?.end.toISOString(), new Date("2026-10-20").toISOString());
}

// isMilestoneItem: only a genuine zero-duration Item (an explicit start
// date equal to its due date) is a milestone. An Item with no start date
// at all is not a milestone — it renders as a single-day bar instead, not
// a diamond, since it never declared a zero-duration start.
{
  const noStart = buildTimelineItems([candidate({ id: "a", dueDate: new Date("2026-10-05") })])[0];
  assert.equal(isMilestoneItem(noStart), false);

  const sameDayStart = buildTimelineItems([
    candidate({ id: "b", startDate: new Date("2026-10-05"), dueDate: new Date("2026-10-05") }),
  ])[0];
  assert.equal(isMilestoneItem(sameDayStart), true);

  const spanning = buildTimelineItems([
    candidate({ id: "c", startDate: new Date("2026-10-01"), dueDate: new Date("2026-10-05") }),
  ])[0];
  assert.equal(isMilestoneItem(spanning), false);
}

// dayOffset counts whole UTC calendar days, and is negative when `date`
// comes before `from`.
{
  assert.equal(dayOffset(new Date("2026-10-05T00:00:00.000Z"), new Date("2026-10-01T00:00:00.000Z")), 4);
  assert.equal(dayOffset(new Date("2026-10-01T00:00:00.000Z"), new Date("2026-10-05T00:00:00.000Z")), -4);
  assert.equal(dayOffset(new Date("2026-10-01T23:59:00.000Z"), new Date("2026-10-01T00:00:00.000Z")), 0);
}

// buildTimelineDayRange pads the Item range by a few days on each side, and
// widens it to include today so the Today marker always lands on-grid.
{
  const range = { start: new Date("2026-10-10T00:00:00.000Z"), end: new Date("2026-10-15T00:00:00.000Z") };
  const today = new Date("2026-10-12T00:00:00.000Z");
  const dayRange = buildTimelineDayRange(range, today);
  assert.equal(dayRange.start.toISOString(), "2026-10-07T00:00:00.000Z");
  assert.equal(dayRange.end.toISOString(), "2026-10-18T00:00:00.000Z");

  const farFutureToday = new Date("2026-12-01T00:00:00.000Z");
  const widenedForToday = buildTimelineDayRange(range, farFutureToday);
  assert.equal(widenedForToday.end.toISOString(), farFutureToday.toISOString());
}

// buildTimelineDays enumerates every UTC day in the range, inclusive.
{
  const days = buildTimelineDays({
    start: new Date("2026-10-01T00:00:00.000Z"),
    end: new Date("2026-10-03T00:00:00.000Z"),
  });
  assert.deepEqual(
    days.map((d) => d.toISOString()),
    ["2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z", "2026-10-03T00:00:00.000Z"]
  );
}

// groupDaysByWeek splits a run of days on Sunday boundaries; the first and
// last groups may be partial weeks.
{
  const days = buildTimelineDays({
    start: new Date("2026-10-01T00:00:00.000Z"), // Thursday
    end: new Date("2026-10-11T00:00:00.000Z"), // Sunday
  });
  const weeks = groupDaysByWeek(days);
  assert.deepEqual(
    weeks.map((w) => w.dayCount),
    [3, 7, 1]
  );
  assert.equal(weeks[0]!.start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(weeks[1]!.start.getUTCDay(), 0);
}

// groupTimelineItems buckets Items by Section in Section order, appends a
// "No Section" bucket last, and drops empty Sections.
{
  const items = buildTimelineItems([
    candidate({ id: "a", sectionId: "s1", dueDate: new Date("2026-10-01") }),
    candidate({ id: "b", sectionId: "s2", dueDate: new Date("2026-10-02") }),
    candidate({ id: "c", sectionId: null, dueDate: new Date("2026-10-03") }),
  ]);
  const groups = groupTimelineItems(items, [
    { id: "s1", name: "Development" },
    { id: "empty", name: "Empty Section" },
    { id: "s2", name: "Design" },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.sectionName, g.items.map((i) => i.id)]),
    [
      ["Development", ["a"]],
      ["Design", ["b"]],
      ["No Section", ["c"]],
    ]
  );
}

// groupTimelineItems collapses to a single unsectioned group when the List
// doesn't use Sections at all — the Timeline view renders that as a flat
// list rather than one lone group header.
{
  const items = buildTimelineItems([candidate({ id: "a", sectionId: null, dueDate: new Date("2026-10-01") })]);
  const groups = groupTimelineItems(items, []);
  assert.deepEqual(groups, [{ sectionId: null, sectionName: "No Section", items }]);
}

console.log("list timeline test passed");
