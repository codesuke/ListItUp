import type { ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { addAssignee } from "@/lib/item/item-assignment";
import { transitionItemState, updateItem } from "@/lib/item/item-lifecycle";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type BoardGroupBy = "SECTION" | "STATE" | "ASSIGNEE";

const VALID_BOARD_GROUP_BY: readonly BoardGroupBy[] = ["SECTION", "STATE", "ASSIGNEE"];

export function isValidBoardGroupBy(value: string): value is BoardGroupBy {
  return (VALID_BOARD_GROUP_BY as readonly string[]).includes(value);
}

export const UNSECTIONED_COLUMN_KEY = "NONE";
export const UNASSIGNED_COLUMN_KEY = "UNASSIGNED";

// Archived Items are excluded from Board by default, matching the List
// view (#29) — both defer the Archived toggle to #38.
const STATE_COLUMNS: { key: ItemState; label: string }[] = [
  { key: "TO_DO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "COMPLETE", label: "Complete" },
];

export type BoardItem = {
  id: string;
  title: string;
  priority: ItemPriority;
  dueDate: Date | null;
  hasParent: boolean;
  sectionId: string | null;
  state: ItemState;
  assignees: { userId: string; name: string }[];
};

export type BoardColumn = { key: string; label: string; items: BoardItem[] };

// Pure — the grouping shape is unit tested directly without a database.
export function groupItemsForBoard(
  items: BoardItem[],
  groupBy: BoardGroupBy,
  sections: { id: string; name: string }[],
  assignableMembers: { userId: string; name: string }[]
): BoardColumn[] {
  if (groupBy === "STATE") {
    return STATE_COLUMNS.map(({ key, label }) => ({
      key,
      label,
      items: items.filter((item) => item.state === key),
    }));
  }

  if (groupBy === "SECTION") {
    const sectionColumns = sections.map((section) => ({
      key: section.id,
      label: section.name,
      items: items.filter((item) => item.sectionId === section.id),
    }));
    return [
      ...sectionColumns,
      { key: UNSECTIONED_COLUMN_KEY, label: "No Section", items: items.filter((item) => !item.sectionId) },
    ];
  }

  // ASSIGNEE: an Item with multiple Assignees appears in each of their
  // columns — a Kanban board grouped by a multi-valued field necessarily
  // shows the same card more than once rather than picking one owner.
  const memberColumns = assignableMembers.map((member) => ({
    key: member.userId,
    label: member.name,
    items: items.filter((item) => item.assignees.some((assignee) => assignee.userId === member.userId)),
  }));
  return [
    ...memberColumns,
    {
      key: UNASSIGNED_COLUMN_KEY,
      label: "Unassigned",
      items: items.filter((item) => item.assignees.length === 0),
    },
  ];
}

export type MoveItemToColumnResult =
  | { status: "moved" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "blocker-reason-required" }
  | { status: "invalid-column" };

// Moving an Item between Board columns updates its grouped field via
// lib/item/'s existing mutation functions (#31) — the same authorization
// and Blocker-reason rules apply as everywhere else those functions are
// called, since this is not a separate mutation path.
export async function moveItemToColumn(
  database: PrismaClient,
  input: {
    actorUserId: string;
    itemId: string;
    groupBy: BoardGroupBy;
    columnKey: string;
    blockerReason?: string;
  }
): Promise<MoveItemToColumnResult> {
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

  if (groupBy === "SECTION") {
    const sectionId = columnKey === UNSECTIONED_COLUMN_KEY ? null : columnKey;
    const result = await updateItem(database, { actorUserId, itemId, sectionId });
    return result.status === "updated" ? { status: "moved" } : result;
  }

  // ASSIGNEE: moving into a column adds that person as an Assignee. Moving
  // into "Unassigned" isn't a well-defined mutation for a multi-valued
  // field (which Assignee, if any, would it remove?) and is rejected
  // rather than silently doing nothing or guessing.
  if (columnKey === UNASSIGNED_COLUMN_KEY) {
    return { status: "invalid-column" };
  }
  const result = await addAssignee(database, { actorUserId, itemId, userId: columnKey });
  return result.status === "added" ? { status: "moved" } : result;
}

export type SetBoardGroupByResult =
  | { status: "updated" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "invalid-group-by" };

// A List Lead, List Member, or the Workspace Owner can change the
// Board's grouping — same threshold as Section management and the List
// view's own "Add Rule" (#29).
const REQUIRED_ACCESS_LEVEL = "WRITE";

export async function setBoardGroupBy(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; groupBy: string }
): Promise<SetBoardGroupByResult> {
  const { actorUserId, listId, groupBy } = input;

  if (!isValidBoardGroupBy(groupBy)) {
    return { status: "invalid-group-by" };
  }

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.list.update({ where: { id: listId }, data: { boardGroupBy: groupBy } });
  return { status: "updated" };
}
