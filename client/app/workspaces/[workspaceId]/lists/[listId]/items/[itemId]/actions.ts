"use server";

import { revalidatePath } from "next/cache";

import type { ItemPriority, ItemState } from "@/generated/prisma/client";
import { addAssignee, removeAssignee } from "@/lib/item/item-assignment";
import { setCustomFieldValue } from "@/lib/item/item-custom-fields";
import { createItem } from "@/lib/item/item-creation";
import { createDependency, removeDependency } from "@/lib/item/item-dependencies";
import { archiveItem, isValidItemState, restoreItem, transitionItemState, updateItem } from "@/lib/item/item-lifecycle";
import { applyLabel, removeLabel } from "@/lib/item/item-labels";
import { createNote, upsertPersonalNote } from "@/lib/item/item-notes";
import { createCustomFieldDefinition } from "@/lib/list/list-custom-fields";
import { createLabel } from "@/lib/list/list-labels";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

function itemPath(workspaceId: string, listId: string, itemId: string): string {
  return `/workspaces/${workspaceId}/lists/${listId}/items/${itemId}`;
}

const VALID_PRIORITIES: readonly ItemPriority[] = ["LOW", "NORMAL", "HIGH"];

// Each field is only included in the update when its key is actually
// present in the submitted FormData — the panel now submits Title,
// Priority, and Due date as independent single-field edits (not one shared
// form), so treating a missing key the same as an explicit empty value
// would silently clear whichever fields weren't part of that particular
// submission.
export async function updateItemDetailsAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const title = formData.has("title") ? String(formData.get("title") ?? "").trim() : undefined;
  const sectionId = formData.has("sectionId") ? String(formData.get("sectionId") ?? "") : undefined;
  const priority = formData.has("priority") ? String(formData.get("priority") ?? "") : undefined;
  const dueDateRaw = formData.has("dueDate") ? String(formData.get("dueDate") ?? "") : undefined;

  await updateItem(prisma, {
    actorUserId: session.user.id,
    itemId,
    ...(title ? { title } : {}),
    ...(sectionId !== undefined ? { sectionId: sectionId || null } : {}),
    ...(priority !== undefined && VALID_PRIORITIES.includes(priority as ItemPriority)
      ? { priority: priority as ItemPriority }
      : {}),
    ...(dueDateRaw !== undefined ? { dueDate: dueDateRaw ? new Date(dueDateRaw) : null } : {}),
  });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function transitionItemStateAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const state = String(formData.get("state") ?? "");
  const blockerReason = String(formData.get("blockerReason") ?? "");

  if (!isValidItemState(state)) {
    return;
  }

  await transitionItemState(prisma, {
    actorUserId: session.user.id,
    itemId,
    state: state as ItemState,
    blockerReason: blockerReason || undefined,
  });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

// Archiving/restoring use lib/item/'s dedicated archiveItem/restoreItem —
// not transitionItemState — so the prior state (and BlockerReason) survive
// the round trip (#38).
export async function archiveItemAction(
  workspaceId: string,
  listId: string,
  itemId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  await archiveItem(prisma, { actorUserId: session.user.id, itemId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function restoreItemAction(
  workspaceId: string,
  listId: string,
  itemId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  await restoreItem(prisma, { actorUserId: session.user.id, itemId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function addItemAssigneeAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  await addAssignee(prisma, { actorUserId: session.user.id, itemId, userId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function removeItemAssigneeAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  userId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  await removeAssignee(prisma, { actorUserId: session.user.id, itemId, userId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function addChildItemAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return;
  }

  await createItem(prisma, { actorUserId: session.user.id, listId, title, parentId: itemId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function applyExistingLabelAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const labelId = String(formData.get("labelId") ?? "");

  if (!labelId) {
    return;
  }

  await applyLabel(prisma, { actorUserId: session.user.id, itemId, labelId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function removeItemLabelAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  labelId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  await removeLabel(prisma, { actorUserId: session.user.id, itemId, labelId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

// Creates a new Workspace Label and applies it to this Item in one step —
// there's no standalone Label-management surface yet, so this is the only
// place a Workspace Owner/Admin can create one (#34).
export async function createAndApplyLabelAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return;
  }

  const created = await createLabel(prisma, { actorUserId: session.user.id, workspaceId, name });
  if (created.status === "created") {
    await applyLabel(prisma, { actorUserId: session.user.id, itemId, labelId: created.labelId });
  }
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function setItemCustomFieldValueAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  definitionId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const value = String(formData.get("value") ?? "");

  await setCustomFieldValue(prisma, { actorUserId: session.user.id, itemId, definitionId, value });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

// Defines a new Custom Field on this Item's List — there's no standalone
// List-settings surface yet, so this is the only place a List Lead/
// Workspace Admin can define one (#34).
export async function defineCustomFieldAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const optionsRaw = String(formData.get("options") ?? "");
  const options = optionsRaw
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);

  if (!name || !type) {
    return;
  }

  await createCustomFieldDefinition(prisma, { actorUserId: session.user.id, listId, name, type, options });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

// direction "blocks" means this Item blocks the target; "blockedBy" means
// this Item is blocked by the target (#35).
export async function addItemDependencyAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const targetItemId = String(formData.get("targetItemId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "");

  if (!targetItemId || (direction !== "blocks" && direction !== "blockedBy")) {
    return;
  }

  const [blockerId, blockedId] = direction === "blocks" ? [itemId, targetItemId] : [targetItemId, itemId];
  await createDependency(prisma, { actorUserId: session.user.id, blockerId, blockedId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function removeItemDependencyAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  await removeDependency(prisma, { actorUserId: session.user.id, blockerId, blockedId });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function addNoteAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const body = String(formData.get("body") ?? "").trim();
  const mentionedUserIds = formData.getAll("mentionedUserIds").map((value) => String(value));

  if (!body) {
    return;
  }

  await createNote(prisma, { actorUserId: session.user.id, itemId, body, mentionedUserIds });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}

export async function upsertPersonalNoteAction(
  workspaceId: string,
  listId: string,
  itemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(itemPath(workspaceId, listId, itemId));
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    return;
  }

  await upsertPersonalNote(prisma, { actorUserId: session.user.id, itemId, body });
  revalidatePath(itemPath(workspaceId, listId, itemId));
}
