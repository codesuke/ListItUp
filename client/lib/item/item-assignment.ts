import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { notifyAssigneeAdded, notifyAssigneeRemoved } from "@/lib/notification/notification-triggers";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

export type AddAssigneeResult =
  | { status: "added" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type RemoveAssigneeResult =
  | { status: "removed" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

// A List Member, Lead, or the Workspace Owner can change an Item's
// Assignees; a List Viewer or Guest cannot (#30). This never touches
// creatorId — Creator attribution stays fixed as Assignees change.
const REQUIRED_ACCESS_LEVEL = "WRITE";

export async function addAssignee(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; userId: string }
): Promise<AddAssigneeResult> {
  const { actorUserId, itemId, userId } = input;

  const item = await database.item.findUnique({
    where: { id: itemId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!item) {
    return { status: "item-not-found" };
  }

  if (isListArchived(item.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveItemAccess(database, { userId: actorUserId, itemId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.itemAssignee.upsert({
    where: { itemId_userId: { itemId, userId } },
    create: { id: randomUUID(), itemId, userId },
    update: {},
  });
  await notifyAssigneeAdded(database, { actorUserId, itemId, assigneeUserId: userId });

  return { status: "added" };
}

export async function removeAssignee(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; userId: string }
): Promise<RemoveAssigneeResult> {
  const { actorUserId, itemId, userId } = input;

  const item = await database.item.findUnique({
    where: { id: itemId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!item) {
    return { status: "item-not-found" };
  }

  if (isListArchived(item.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveItemAccess(database, { userId: actorUserId, itemId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.itemAssignee.deleteMany({ where: { itemId, userId } });
  await notifyAssigneeRemoved(database, { actorUserId, itemId, assigneeUserId: userId });

  return { status: "removed" };
}
