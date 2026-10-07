import type { ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { myTaskWorkspaceLabel, type MyTaskItem } from "@/lib/item/item-my-tasks";
import { transitionItemState, updateItem } from "@/lib/item/item-lifecycle";

// My Tasks' Board groups a cross-Workspace Item set, so List Board's own
// SECTION/ASSIGNEE fields don't translate (Sections are per-List, and
// there's no single assignable-member pool spanning every Workspace the
// User belongs to). STATE mirrors List Board exactly; PRIORITY and
// WORKSPACE are the two additional fields that make sense unified across
// Workspaces (#43 — "consistent with #17's Board grouping mechanism"
// means the same shape: a validated groupBy plus a pure grouping
// function, not the identical field set).
export type MyTasksBoardGroupBy = "STATE" | "PRIORITY" | "WORKSPACE";

const VALID_GROUP_BY: readonly MyTasksBoardGroupBy[] = ["STATE", "PRIORITY", "WORKSPACE"];

export function isValidMyTasksBoardGroupBy(value: string): value is MyTasksBoardGroupBy {
  return (VALID_GROUP_BY as readonly string[]).includes(value);
}

// My Tasks' own state visibility filter (includeCompleted/includeArchived)
// already trims the Item set before it reaches this function, so — unlike
// List Board, which always excludes ARCHIVED itself — Board here just
// mirrors whatever states are present.
const STATE_COLUMNS: { key: ItemState; label: string }[] = [
  { key: "TO_DO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "COMPLETE", label: "Complete" },
  { key: "ARCHIVED", label: "Archived" },
];

const PRIORITY_COLUMNS: { key: ItemPriority; label: string }[] = [
  { key: "HIGH", label: "High" },
  { key: "NORMAL", label: "Normal" },
  { key: "LOW", label: "Low" },
];

export type MyTasksBoardColumn = { key: string; label: string; items: MyTaskItem[] };

// Pure — the grouping shape is unit tested directly without a database.
export function groupMyTasksForBoard(
  items: MyTaskItem[],
  groupBy: MyTasksBoardGroupBy
): MyTasksBoardColumn[] {
  if (groupBy === "STATE") {
    return STATE_COLUMNS.map(({ key, label }) => ({
      key,
      label,
      items: items.filter((item) => item.state === key),
    }));
  }

  if (groupBy === "PRIORITY") {
    return PRIORITY_COLUMNS.map(({ key, label }) => ({
      key,
      label,
      items: items.filter((item) => item.priority === key),
    }));
  }

  // WORKSPACE: one column per distinct source Workspace actually present
  // in the Item set, in first-seen order — there's no fixed Workspace list
  // to render empty columns for, unlike STATE/PRIORITY's closed enums.
  const columns: MyTasksBoardColumn[] = [];
  const columnByWorkspaceId = new Map<string, MyTasksBoardColumn>();
  for (const item of items) {
    let column = columnByWorkspaceId.get(item.sourceWorkspaceId);
    if (!column) {
      column = {
        key: item.sourceWorkspaceId,
        label: myTaskWorkspaceLabel(item),
        items: [],
      };
      columnByWorkspaceId.set(item.sourceWorkspaceId, column);
      columns.push(column);
    }
    column.items.push(item);
  }
  return columns;
}

export type MoveMyTaskItemResult =
  | { status: "moved" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "blocker-reason-required" }
  | { status: "invalid-column" }
  | { status: "list-archived" };

// Moving a card updates the Item via the same lib/item/ mutation functions
// used everywhere else (#43, matching #17's Board — see moveItemToColumn
// in lib/list/list-board.ts) — every dispatch target re-resolves access
// against that specific Item's own List, so this is safe to call across
// Workspaces without any extra plumbing here.
export async function moveMyTaskItemToColumn(
  database: PrismaClient,
  input: {
    actorUserId: string;
    itemId: string;
    groupBy: MyTasksBoardGroupBy;
    columnKey: string;
    blockerReason?: string;
  }
): Promise<MoveMyTaskItemResult> {
  const { actorUserId, itemId, groupBy, columnKey, blockerReason } = input;

  if (groupBy === "STATE") {
    if (!STATE_COLUMNS.some((column) => column.key === columnKey)) {
      return { status: "invalid-column" };
    }
    const result = await transitionItemState(database, {
      actorUserId,
      itemId,
      state: columnKey as ItemState,
      blockerReason,
    });
    return result.status === "transitioned" ? { status: "moved" } : result;
  }

  if (groupBy === "PRIORITY") {
    if (!PRIORITY_COLUMNS.some((column) => column.key === columnKey)) {
      return { status: "invalid-column" };
    }
    const result = await updateItem(database, { actorUserId, itemId, priority: columnKey as ItemPriority });
    return result.status === "updated" ? { status: "moved" } : result;
  }

  // WORKSPACE: an Item's source Workspace is fixed by which List it lives
  // in — moving it to another Workspace's column would mean re-listing it
  // under a different List entirely, which is out of scope here. This
  // grouping is view-only, matching List Board's own precedent for a
  // grouped field it declines to make movable (its ASSIGNEE→Unassigned
  // case).
  return { status: "invalid-column" };
}
