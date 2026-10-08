import type { Item, ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { meetsListAccessLevel, resolveListAccessForMany } from "@/lib/permissions/list-access";
import { ACTIVE_WORKSPACE_WHERE } from "@/lib/workspace/workspace-visibility";

export type AssignedByMeItem = {
  id: string;
  title: string;
  state: ItemState;
  priority: ItemPriority;
  dueDate: Date | null;
  listId: string;
  listName: string;
  assigneeCount: number;
  assigneeNames: string[];
};

function toAssignedByMeItem(
  item: Item & { list: { id: string; name: string }; assignees: { user: { name: string } }[] }
): AssignedByMeItem {
  return {
    id: item.id,
    title: item.title,
    state: item.state,
    priority: item.priority,
    dueDate: item.dueDate,
    listId: item.list.id,
    listName: item.list.name,
    assigneeCount: item.assignees.length,
    assigneeNames: item.assignees.map((assignee) => assignee.user.name),
  };
}

// "Items I've Assigned" (#46, Home) approximates delegated work as
// Creator == current User AND the Assignee list includes someone other
// than the current User — there is no dedicated "assigned by" field, so
// this misses delegation on Items the current User didn't create
// themself. A known, revisitable approximation, not a durable contract
// (docs/QnA/listitup-profile-and-home-surface.md §13).
export async function loadAssignedByMeItems(
  database: PrismaClient,
  input: { userId: string; workspaceId: string; limit?: number }
): Promise<AssignedByMeItem[]> {
  const { userId, workspaceId, limit } = input;

  const items = await database.item.findMany({
    where: {
      creatorId: userId,
      list: {
        workspaceId,
        // A frozen/closed List's Items don't clutter this queue either
        // (#107 story 9), and a Deleted Workspace was a pre-existing,
        // unticketed gap this surface never closed the way My Tasks
        // already had (ADR 0021).
        archivedAt: null,
        workspace: ACTIVE_WORKSPACE_WHERE,
      },
      assignees: { some: { userId: { not: userId } } },
    },
    include: {
      list: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  // The viewer here is the creator, who can lose List access the same way
  // an Assignee can (#107/ADR 0021) — re-checked at read time rather than
  // relying on the ItemAssignee rows it created staying valid forever.
  const accessByListId = await resolveListAccessForMany(database, {
    userId,
    listIds: items.map((item) => item.listId),
  });
  const visibleItems = items.filter((item) =>
    meetsListAccessLevel(accessByListId.get(item.listId) ?? "NONE", "READ")
  );

  return visibleItems.map(toAssignedByMeItem);
}
