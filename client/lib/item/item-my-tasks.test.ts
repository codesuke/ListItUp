import assert from "node:assert/strict";

import {
  applyMyTasksSort,
  breakdownByList,
  buildMyTasksSmartSections,
  groupMyTasksItems,
  isItemOverdue,
  isValidMyTasksGroupBy,
  isValidMyTasksSortBy,
  isVisibleByDefault,
  myTaskItemHref,
  myTaskRowBadge,
  sortMyTasks,
} from "./item-my-tasks";

// isVisibleByDefault: only COMPLETE/ARCHIVED are hidden unless explicitly
// requested (#42) — TO_DO, IN_PROGRESS, and BLOCKED all show by default.
assert.equal(isVisibleByDefault("TO_DO"), true);
assert.equal(isVisibleByDefault("IN_PROGRESS"), true);
assert.equal(isVisibleByDefault("BLOCKED"), true);
assert.equal(isVisibleByDefault("COMPLETE"), false);
assert.equal(isVisibleByDefault("ARCHIVED"), false);

// isItemOverdue
const now = new Date("2026-09-15T12:00:00.000Z");
assert.equal(isItemOverdue({ dueDate: new Date("2026-09-01T00:00:00.000Z") }, now), true);
assert.equal(isItemOverdue({ dueDate: new Date("2026-09-30T00:00:00.000Z") }, now), false);
assert.equal(isItemOverdue({ dueDate: null }, now), false);

// sortMyTasks: overdue first, then Priority (High first), then nearest due
// date, with undated Items sorted after every dated Item in the same
// overdue/Priority bucket (#42).
{
  const overdueHigh = { id: "overdue-high", state: "TO_DO" as const, priority: "HIGH" as const, dueDate: new Date("2026-09-01T00:00:00.000Z") };
  const overdueLow = { id: "overdue-low", state: "TO_DO" as const, priority: "LOW" as const, dueDate: new Date("2026-09-05T00:00:00.000Z") };
  const upcomingHighNear = { id: "upcoming-high-near", state: "TO_DO" as const, priority: "HIGH" as const, dueDate: new Date("2026-09-20T00:00:00.000Z") };
  const upcomingHighFar = { id: "upcoming-high-far", state: "TO_DO" as const, priority: "HIGH" as const, dueDate: new Date("2026-09-25T00:00:00.000Z") };
  const upcomingHighUndated = { id: "upcoming-high-undated", state: "TO_DO" as const, priority: "HIGH" as const, dueDate: null };
  const upcomingNormal = { id: "upcoming-normal", state: "TO_DO" as const, priority: "NORMAL" as const, dueDate: new Date("2026-09-21T00:00:00.000Z") };

  const shuffled = [
    upcomingNormal,
    upcomingHighUndated,
    overdueLow,
    upcomingHighFar,
    overdueHigh,
    upcomingHighNear,
  ];

  const sorted = sortMyTasks(shuffled, now);

  assert.deepEqual(
    sorted.map((item) => item.id),
    [
      "overdue-high",
      "overdue-low",
      "upcoming-high-near",
      "upcoming-high-far",
      "upcoming-high-undated",
      "upcoming-normal",
    ]
  );
}

// isValidMyTasksSortBy / isValidMyTasksGroupBy: allow-list guards for the
// query-param values threading in from the URL (#44) — untrusted input
// must be validated before it drives behavior.
assert.equal(isValidMyTasksSortBy("SMART"), true);
assert.equal(isValidMyTasksSortBy("DUE_DATE"), true);
assert.equal(isValidMyTasksSortBy("bogus"), false);
assert.equal(isValidMyTasksGroupBy("WORKSPACE"), true);
assert.equal(isValidMyTasksGroupBy("bogus"), false);

// applyMyTasksSort: each non-SMART mode overrides the default ordering.
{
  const items = [
    { id: "b", title: "Bravo", priority: "LOW" as const, dueDate: new Date("2026-09-20T00:00:00.000Z") },
    { id: "a", title: "Alpha", priority: "HIGH" as const, dueDate: null },
    { id: "c", title: "Charlie", priority: "NORMAL" as const, dueDate: new Date("2026-09-10T00:00:00.000Z") },
  ];

  assert.deepEqual(
    applyMyTasksSort(items, "DUE_DATE", now).map((item) => item.id),
    ["c", "b", "a"],
    "DUE_DATE: nearest first, undated last"
  );
  assert.deepEqual(
    applyMyTasksSort(items, "PRIORITY", now).map((item) => item.id),
    ["a", "c", "b"],
    "PRIORITY: High first"
  );
  assert.deepEqual(
    applyMyTasksSort(items, "TITLE", now).map((item) => item.id),
    ["a", "b", "c"],
    "TITLE: alphabetical"
  );
}

// groupMyTasksItems: NONE is a single unlabeled group; WORKSPACE/PRIORITY/
// DUE_DATE bucket without dropping or duplicating any Item, and omit empty
// buckets (#44).
{
  const workspaceA = { sourceWorkspaceId: "ws-a", sourceWorkspaceName: "Marketing", sourceWorkspaceKind: "SHARED" as const };
  const personal = { sourceWorkspaceId: "ws-p", sourceWorkspaceName: "Personal Space", sourceWorkspaceKind: "PERSONAL" as const };
  const overdue = { id: "overdue", priority: "HIGH" as const, dueDate: new Date("2026-09-01T00:00:00.000Z"), ...workspaceA };
  const today = { id: "today", priority: "NORMAL" as const, dueDate: new Date("2026-09-15T18:00:00.000Z"), ...workspaceA };
  const upcoming = { id: "upcoming", priority: "LOW" as const, dueDate: new Date("2026-09-20T00:00:00.000Z"), ...personal };
  const undated = { id: "undated", priority: "LOW" as const, dueDate: null, ...personal };
  const items = [overdue, today, upcoming, undated];

  const none = groupMyTasksItems(items, "NONE", now);
  assert.deepEqual(none, [{ key: "ALL", label: "", items }]);

  const byWorkspace = groupMyTasksItems(items, "WORKSPACE", now);
  assert.deepEqual(
    byWorkspace.map((group) => [group.label, group.items.map((item) => item.id)]),
    [
      ["Marketing", ["overdue", "today"]],
      ["Personal Space", ["upcoming", "undated"]],
    ]
  );

  const byPriority = groupMyTasksItems(items, "PRIORITY", now);
  assert.deepEqual(
    byPriority.map((group) => [group.label, group.items.map((item) => item.id)]),
    [
      ["High", ["overdue"]],
      ["Normal", ["today"]],
      ["Low", ["upcoming", "undated"]],
    ]
  );

  const byDueDate = groupMyTasksItems(items, "DUE_DATE", now);
  assert.deepEqual(
    byDueDate.map((group) => [group.label, group.items.map((item) => item.id)]),
    [
      ["Overdue", ["overdue"]],
      ["Today", ["today"]],
      ["Upcoming", ["upcoming"]],
      ["No due date", ["undated"]],
    ]
  );
}

// myTaskItemHref: the one place the Item detail URL shape is assembled,
// shared by every My Tasks view's row link and the Share link (#43, #44).
assert.equal(
  myTaskItemHref({ sourceWorkspaceId: "ws-1", listId: "list-1" }, "item-1"),
  "/workspaces/ws-1/lists/list-1/items/item-1"
);

// buildMyTasksSmartSections (design-mocks/my-tasks default grouping):
// Blocked is its own section regardless of due date — even one that would
// otherwise be Overdue — and everything else buckets by due date.
{
  const overdue = { id: "overdue", state: "TO_DO" as const, priority: "HIGH" as const, dueDate: new Date("2026-09-01") };
  const blockedOverdue = {
    id: "blocked-overdue",
    state: "BLOCKED" as const,
    priority: "NORMAL" as const,
    dueDate: new Date("2026-09-01"),
  };
  const today = {
    id: "today",
    state: "TO_DO" as const,
    priority: "NORMAL" as const,
    dueDate: new Date("2026-09-15T20:00:00.000Z"),
  };
  const upcoming = { id: "upcoming", state: "TO_DO" as const, priority: "LOW" as const, dueDate: new Date("2026-09-20") };
  const undated = { id: "undated", state: "TO_DO" as const, priority: "LOW" as const, dueDate: null };

  const sections = buildMyTasksSmartSections([overdue, blockedOverdue, today, upcoming, undated], now);

  assert.deepEqual(
    sections.map((section) => [section.label, section.items.map((item) => item.id)]),
    [
      ["Overdue", ["overdue"]],
      ["Blocked", ["blocked-overdue"]],
      ["Today", ["today"]],
      ["Upcoming", ["upcoming"]],
      ["No due date", ["undated"]],
    ]
  );
}

// myTaskRowBadge: Blocked beats any date (showing the blocker reason, or a
// fallback if none is set), then Complete, then the date itself — "Today"
// reads better than a formatted date for something due today.
{
  assert.deepEqual(
    myTaskRowBadge({ state: "BLOCKED", dueDate: new Date("2026-09-01"), blockerReason: "Awaiting vendor" }, now),
    { tone: "amber", label: "Awaiting vendor" }
  );
  assert.deepEqual(
    myTaskRowBadge({ state: "BLOCKED", dueDate: null, blockerReason: null }, now),
    { tone: "amber", label: "Blocked" }
  );
  assert.deepEqual(
    myTaskRowBadge({ state: "COMPLETE", dueDate: new Date("2026-09-01"), blockerReason: null }, now),
    { tone: "green", label: "Complete" }
  );
  assert.deepEqual(
    myTaskRowBadge({ state: "TO_DO", dueDate: null, blockerReason: null }, now),
    { tone: "muted", label: "Undated" }
  );
  assert.deepEqual(
    myTaskRowBadge({ state: "TO_DO", dueDate: new Date("2026-09-01"), blockerReason: null }, now),
    { tone: "red", label: "Sep 1" }
  );
  assert.deepEqual(
    myTaskRowBadge({ state: "TO_DO", dueDate: new Date("2026-09-15T20:00:00.000Z"), blockerReason: null }, now),
    { tone: "blue", label: "Today" }
  );
  assert.deepEqual(
    myTaskRowBadge({ state: "TO_DO", dueDate: new Date("2026-09-20"), blockerReason: null }, now),
    { tone: "blue", label: "Sep 20" }
  );
}

// breakdownByList: one entry per source List (across every source
// Workspace), ordered by count descending so the Dashboard's busiest List
// reads first (design-mocks/my-tasks-dashboard, #46).
{
  const listItem = (listId: string, listName: string) => ({ listId, listName });

  const items = [
    listItem("backlog", "Backlog"),
    listItem("inbox", "Inbox"),
    listItem("backlog", "Backlog"),
    listItem("groceries", "Groceries"),
    listItem("backlog", "Backlog"),
    listItem("inbox", "Inbox"),
  ];

  assert.deepEqual(breakdownByList(items), [
    { listId: "backlog", label: "Backlog", count: 3 },
    { listId: "inbox", label: "Inbox", count: 2 },
    { listId: "groceries", label: "Groceries", count: 1 },
  ]);
}

assert.deepEqual(breakdownByList([]), []);

console.log("item my-tasks test passed");
