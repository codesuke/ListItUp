import assert from "node:assert/strict";

import { groupMyTasksForBoard, isValidMyTasksBoardGroupBy } from "./item-my-tasks-board";
import type { MyTaskItem } from "./item-my-tasks";

// isValidMyTasksBoardGroupBy
assert.equal(isValidMyTasksBoardGroupBy("STATE"), true);
assert.equal(isValidMyTasksBoardGroupBy("PRIORITY"), true);
assert.equal(isValidMyTasksBoardGroupBy("WORKSPACE"), true);
assert.equal(isValidMyTasksBoardGroupBy("SECTION"), false);
assert.equal(isValidMyTasksBoardGroupBy("ASSIGNEE"), false);
assert.equal(isValidMyTasksBoardGroupBy(""), false);

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

// Grouped by State: fixed columns, including Archived — unlike List
// Board, My Tasks' own visibility filter already trims the Item set
// before this function runs, so there's no second exclusion here.
{
  const items: MyTaskItem[] = [
    item({ id: "a", state: "TO_DO" }),
    item({ id: "b", state: "BLOCKED" }),
    item({ id: "c", state: "COMPLETE" }),
    item({ id: "d", state: "ARCHIVED" }),
  ];
  const columns = groupMyTasksForBoard(items, "STATE");
  assert.deepEqual(
    columns.map((c) => c.key),
    ["TO_DO", "IN_PROGRESS", "BLOCKED", "COMPLETE", "ARCHIVED"]
  );
  assert.deepEqual(columns[0].items.map((i) => i.id), ["a"]);
  assert.deepEqual(columns[2].items.map((i) => i.id), ["b"]);
  assert.deepEqual(columns[3].items.map((i) => i.id), ["c"]);
  assert.deepEqual(columns[4].items.map((i) => i.id), ["d"]);
}

// Grouped by Priority: fixed High/Normal/Low columns.
{
  const items: MyTaskItem[] = [
    item({ id: "a", priority: "HIGH" }),
    item({ id: "b", priority: "LOW" }),
    item({ id: "c", priority: "NORMAL" }),
  ];
  const columns = groupMyTasksForBoard(items, "PRIORITY");
  assert.deepEqual(
    columns.map((c) => c.key),
    ["HIGH", "NORMAL", "LOW"]
  );
  assert.deepEqual(columns[0].items.map((i) => i.id), ["a"]);
  assert.deepEqual(columns[1].items.map((i) => i.id), ["c"]);
  assert.deepEqual(columns[2].items.map((i) => i.id), ["b"]);
}

// Grouped by Workspace: one column per distinct source Workspace actually
// present, first-seen order, with the Personal Space labeled distinctly.
{
  const items: MyTaskItem[] = [
    item({ id: "a", sourceWorkspaceId: "ws-1", sourceWorkspaceName: "Marketing", sourceWorkspaceKind: "SHARED" }),
    item({ id: "b", sourceWorkspaceId: "ws-2", sourceWorkspaceName: "Personal Space", sourceWorkspaceKind: "PERSONAL" }),
    item({ id: "c", sourceWorkspaceId: "ws-1", sourceWorkspaceName: "Marketing", sourceWorkspaceKind: "SHARED" }),
  ];
  const columns = groupMyTasksForBoard(items, "WORKSPACE");
  assert.deepEqual(
    columns.map((c) => c.key),
    ["ws-1", "ws-2"]
  );
  assert.deepEqual(columns[0].label, "Marketing");
  assert.deepEqual(columns[1].label, "Personal Space");
  assert.deepEqual(columns[0].items.map((i) => i.id), ["a", "c"]);
  assert.deepEqual(columns[1].items.map((i) => i.id), ["b"]);
}

console.log("item my-tasks board test passed");
