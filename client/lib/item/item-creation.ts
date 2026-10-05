import { randomUUID } from "node:crypto";

import type { ItemPriority, PrismaClient } from "@/generated/prisma/client";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type CreateItemResult =
  | { status: "created"; itemId: string }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "parent-not-found" }
  | { status: "parent-not-in-list" };

// A List Member, Lead, or the Workspace Owner can create an Item; a List
// Viewer or Guest cannot (#30).
const REQUIRED_ACCESS_LEVEL = "WRITE";

export async function createItem(
  database: PrismaClient,
  input: {
    actorUserId: string;
    listId: string;
    title: string;
    sectionId?: string;
    parentId?: string;
    priority?: ItemPriority;
    dueDate?: Date;
    assigneeUserIds?: string[];
  }
): Promise<CreateItemResult> {
  const { actorUserId, listId, title, sectionId, parentId, priority, dueDate, assigneeUserIds } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  if (parentId) {
    const parent = await database.item.findUnique({ where: { id: parentId } });
    if (!parent) {
      return { status: "parent-not-found" };
    }
    if (parent.listId !== listId) {
      return { status: "parent-not-in-list" };
    }
  }

  const item = await database.item.create({
    data: {
      id: randomUUID(),
      listId,
      title,
      sectionId,
      parentId,
      priority: priority ?? "NORMAL",
      dueDate,
      // Set once here; every other lib/item/ mutation must never touch
      // this field again (Creator immutability, #23/#30).
      creatorId: actorUserId,
      assignees: assigneeUserIds?.length
        ? { create: assigneeUserIds.map((userId) => ({ id: randomUUID(), userId })) }
        : undefined,
    },
  });

  return { status: "created", itemId: item.id };
}
