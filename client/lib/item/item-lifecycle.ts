import type { ItemPriority, ItemState, PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { notifyItemStateChanged } from "@/lib/notification/notification-triggers";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

export type UpdateItemResult =
  | { status: "updated" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type TransitionItemStateResult =
  | { status: "transitioned" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "blocker-reason-required" }
  | { status: "list-archived" };

// A List Member, Lead, or the Workspace Owner can update/transition an
// Item; a List Viewer or Guest cannot (#30). Any single Assignee who is
// also at least a List Member can transition to COMPLETE on their own —
// there is no multi-Assignee consensus mechanism to bypass, so this is the
// same gate as every other transition.
const REQUIRED_ACCESS_LEVEL = "WRITE";

const ITEM_STATES: readonly ItemState[] = ["TO_DO", "IN_PROGRESS", "BLOCKED", "COMPLETE", "ARCHIVED"];

export function isValidItemState(value: string): value is ItemState {
  return (ITEM_STATES as readonly string[]).includes(value);
}

export function validateStateTransition(
  nextState: ItemState,
  blockerReason: string | undefined
): { valid: true } | { valid: false; reason: "blocker-reason-required" } {
  if (nextState === "BLOCKED" && !blockerReason?.trim()) {
    return { valid: false, reason: "blocker-reason-required" };
  }
  return { valid: true };
}

export async function updateItem(
  database: PrismaClient,
  input: {
    actorUserId: string;
    itemId: string;
    title?: string;
    sectionId?: string | null;
    priority?: ItemPriority;
    dueDate?: Date | null;
  }
): Promise<UpdateItemResult> {
  const { actorUserId, itemId, title, sectionId, priority, dueDate } = input;

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

  await database.item.update({
    where: { id: itemId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(sectionId !== undefined ? { sectionId } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
    },
  });

  return { status: "updated" };
}

export async function transitionItemState(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; state: ItemState; blockerReason?: string }
): Promise<TransitionItemStateResult> {
  const { actorUserId, itemId, state, blockerReason } = input;

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

  const transition = validateStateTransition(state, blockerReason);
  if (!transition.valid) {
    return { status: transition.reason };
  }

  await database.item.update({
    where: { id: itemId },
    data: { state, blockerReason: state === "BLOCKED" ? blockerReason!.trim() : null },
  });
  await notifyItemStateChanged(database, { actorUserId, itemId });

  return { status: "transitioned" };
}

// Archiving suspends an Item without going through transitionItemState's
// generic BLOCKED/blockerReason rules: it stashes the current state in
// stateBeforeArchive and otherwise leaves every field (including
// blockerReason) untouched, so restoreItem can put the Item back exactly
// as it was (#38).
export async function archiveItem(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string }
): Promise<TransitionItemStateResult> {
  const { actorUserId, itemId } = input;

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

  await database.item.update({
    where: { id: itemId },
    data: { state: "ARCHIVED", stateBeforeArchive: item.state },
  });

  return { status: "transitioned" };
}

export async function restoreItem(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string }
): Promise<TransitionItemStateResult> {
  const { actorUserId, itemId } = input;

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

  await database.item.update({
    where: { id: itemId },
    // Falls back to TO_DO for an Item archived before stateBeforeArchive
    // existed, or archived some other way that didn't set it.
    data: { state: item.stateBeforeArchive ?? "TO_DO", stateBeforeArchive: null },
  });

  return { status: "transitioned" };
}
