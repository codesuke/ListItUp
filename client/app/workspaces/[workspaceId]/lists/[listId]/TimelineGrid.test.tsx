import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { STATE_COLOR } from "@/lib/list/list-timeline";

import { TimelineGrid, type TimelineGridGroup, type TimelineGridItem } from "./TimelineGrid";

// Renders the real component (not a mock) and reads the actual DOM output,
// so this catches the class of bug where the dot/bar/diamond stop reading
// from the same status→color lookup — a mismatch that types alone can't
// catch, since `data-testid`/`style` are just string attributes to the
// compiler.
function extractInlineStyle(html: string, testId: string): string {
  const tagMatch = html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`));
  assert.ok(tagMatch, `expected an element with data-testid="${testId}"`);
  const styleMatch = tagMatch![0].match(/style="([^"]*)"/);
  assert.ok(styleMatch, `element ${testId} has no inline style attribute`);
  return styleMatch![1]!;
}

function makeItem(overrides: Partial<TimelineGridItem> & Pick<TimelineGridItem, "id" | "state">): TimelineGridItem {
  return {
    id: overrides.id,
    title: overrides.title ?? `Item ${overrides.id}`,
    state: overrides.state,
    hasParent: false,
    href: `/items/${overrides.id}`,
    assignees: [],
    startDayIndex: overrides.startDayIndex ?? 0,
    endDayIndex: overrides.endDayIndex ?? 3,
    isMilestone: overrides.isMilestone ?? false,
    dateLabel: "",
  };
}

const days = Array.from({ length: 10 }, (_, i) => ({
  dayNumber: i + 1,
  weekdayLabel: "Mon",
  shortLabel: `Jan ${i + 1}`,
  year: 2026,
}));
const weeks = [{ label: "Jan 1 – Jan 10", dayCount: 10 }];

const groups: TimelineGridGroup[] = [
  {
    sectionId: "backlog",
    sectionName: "Backlog",
    items: [makeItem({ id: "todo-1", state: "TO_DO", startDayIndex: 0, endDayIndex: 3 })],
  },
  {
    sectionId: "in-progress",
    sectionName: "In Progress",
    items: [makeItem({ id: "prog-1", state: "IN_PROGRESS", startDayIndex: 1, endDayIndex: 5 })],
  },
  {
    sectionId: "blocked",
    sectionName: "Blocked",
    items: [makeItem({ id: "block-1", state: "BLOCKED", startDayIndex: 2, endDayIndex: 4 })],
  },
  {
    sectionId: "done",
    sectionName: "Done",
    items: [
      makeItem({ id: "done-1", state: "COMPLETE", startDayIndex: 3, endDayIndex: 6 }),
      // A genuine milestone — startDayIndex === endDayIndex and isMilestone
      // true — covers the diamond's color path too, not just the bar's.
      makeItem({ id: "milestone-1", state: "TO_DO", startDayIndex: 8, endDayIndex: 8, isMilestone: true }),
    ],
  },
];

const html = renderToStaticMarkup(
  <TimelineGrid days={days} weeks={weeks} todayDayIndex={-1} groups={groups} isFlatList={false} assigneeOptions={[]} />
);

// For every Item across every Section, its status dot and its bar/diamond
// must both resolve to STATE_COLOR[item.state] — the same task's status
// can never render two different colors.
for (const group of groups) {
  for (const item of group.items) {
    const expectedColor = STATE_COLOR[item.state];
    const dotStyle = extractInlineStyle(html, `dot-${item.id}`);
    assert.ok(
      dotStyle.includes(`background-color:${expectedColor}`),
      `${item.id} (${item.state}): dot style "${dotStyle}" does not use ${expectedColor}`
    );
    const barStyle = extractInlineStyle(html, `bar-${item.id}`);
    assert.ok(
      barStyle.includes(`background-color:${expectedColor}`),
      `${item.id} (${item.state}): bar/diamond style "${barStyle}" does not use ${expectedColor}`
    );
  }
}

// The week header label doesn't wrap: it renders inside a `truncate`
// (nowrap + ellipsis) span rather than as bare text.
assert.match(html, /<span class="min-w-0 truncate[^"]*">Jan 1 – Jan 10<\/span>/);

console.log("TimelineGrid color/markup test passed");
