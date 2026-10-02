"use server";

import { revalidatePath } from "next/cache";

import type { ListMemberRole } from "@/generated/prisma/client";
import { createItem } from "@/lib/item/item-creation";
import { restoreItem, transitionItemState } from "@/lib/item/item-lifecycle";
import { isValidBoardGroupBy, moveItemToColumn, setBoardGroupBy, type BoardGroupBy } from "@/lib/list/list-board";
import { grantGuestAccess, revokeGuestAccess } from "@/lib/list/list-guests";
import { setListStatus, updateListDescription } from "@/lib/list/list-lifecycle";
import { addListMember, removeListMember } from "@/lib/list/list-membership";
import {
  createSection,
  deleteSection,
  duplicateSection,
  renameSection,
  reorderSections,
  setListGroupBy,
} from "@/lib/list/list-sections";
import { prisma } from "@/lib/prisma";
import { setPeerComparisonEnabled } from "@/lib/workspace/workspace-peer-comparison";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

function listPath(workspaceId: string, listId: string): string {
  return `/workspaces/${workspaceId}/lists/${listId}`;
}

// The Roles panel only ever offers Member/Viewer (#28) — promoting someone
// to List Lead isn't part of this ticket's scope.
const ADDABLE_ROLES: readonly ListMemberRole[] = ["MEMBER", "VIEWER"];

export async function updateListDescriptionAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const description = String(formData.get("description") ?? "");

  await updateListDescription(prisma, { userId: session.user.id, listId, description });
  revalidatePath(listPath(workspaceId, listId));
}

export async function setListStatusAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const status = String(formData.get("status") ?? "");

  await setListStatus(prisma, { userId: session.user.id, listId, status });
  revalidatePath(listPath(workspaceId, listId));
}

export async function addListMemberAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const targetUserId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!targetUserId || !ADDABLE_ROLES.includes(role as ListMemberRole)) {
    return;
  }

  await addListMember(prisma, {
    actorUserId: session.user.id,
    listId,
    userId: targetUserId,
    role: role as ListMemberRole,
  });
  revalidatePath(listPath(workspaceId, listId));
}

export async function removeListMemberAction(
  workspaceId: string,
  listId: string,
  targetUserId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  await removeListMember(prisma, { actorUserId: session.user.id, listId, userId: targetUserId });
  revalidatePath(listPath(workspaceId, listId));
}

export async function grantGuestAccessAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return;
  }

  await grantGuestAccess(prisma, { actorUserId: session.user.id, listId, email });
  revalidatePath(listPath(workspaceId, listId));
}

export async function revokeGuestAccessAction(
  workspaceId: string,
  listId: string,
  targetUserId: string
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  await revokeGuestAccess(prisma, { actorUserId: session.user.id, listId, userId: targetUserId });
  revalidatePath(listPath(workspaceId, listId));
}

export async function addSectionAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return;
  }

  await createSection(prisma, { actorUserId: session.user.id, listId, name });
  revalidatePath(listPath(workspaceId, listId));
}

// sectionId/direction/itemId travel as hidden form fields rather than
// bound closure arguments on every per-item/per-Section action below —
// a Server Component may only pass a Client Component an already-bound
// Server Action reference whose only remaining parameter is FormData
// (React can't serialize a hand-written closure that itself calls .bind()
// across that boundary, and a partially-bound reference expecting a plain
// string next loses its Server Action identity the same way). See
// SectionList.tsx/BoardView.tsx for the hidden-input call sites.
export async function renameSectionAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const sectionId = String(formData.get("sectionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!sectionId || !name) {
    return;
  }

  await renameSection(prisma, { actorUserId: session.user.id, sectionId, name });
  revalidatePath(listPath(workspaceId, listId));
}

export async function duplicateSectionAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const sectionId = String(formData.get("sectionId") ?? "");

  if (!sectionId) {
    return;
  }

  await duplicateSection(prisma, { actorUserId: session.user.id, sectionId });
  revalidatePath(listPath(workspaceId, listId));
}

export async function deleteSectionAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const sectionId = String(formData.get("sectionId") ?? "");

  if (!sectionId) {
    return;
  }

  await deleteSection(prisma, { actorUserId: session.user.id, sectionId });
  revalidatePath(listPath(workspaceId, listId));
}

function isMoveDirection(value: FormDataEntryValue | null): value is "up" | "down" {
  return value === "up" || value === "down";
}

export async function moveSectionAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const sectionId = String(formData.get("sectionId") ?? "");
  const direction = formData.get("direction");

  if (!sectionId || !isMoveDirection(direction)) {
    return;
  }

  const sections = await prisma.section.findMany({ where: { listId }, orderBy: { order: "asc" } });
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const swapWithIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex === -1 || swapWithIndex < 0 || swapWithIndex >= sections.length) {
    return;
  }

  const orderedSectionIds = sections.map((section) => section.id);
  [orderedSectionIds[currentIndex], orderedSectionIds[swapWithIndex]] = [
    orderedSectionIds[swapWithIndex],
    orderedSectionIds[currentIndex],
  ];

  await reorderSections(prisma, { actorUserId: session.user.id, listId, orderedSectionIds });
  revalidatePath(listPath(workspaceId, listId));
}

export async function setListGroupByAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const groupBy = String(formData.get("groupBy") ?? "");

  await setListGroupBy(prisma, { actorUserId: session.user.id, listId, groupBy });
  revalidatePath(listPath(workspaceId, listId));
}

export async function addItemAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const sectionId = String(formData.get("sectionId") ?? "") || undefined;
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return;
  }

  await createItem(prisma, {
    actorUserId: session.user.id,
    listId,
    title,
    sectionId,
  });
  revalidatePath(listPath(workspaceId, listId));
}

// The List/Board Archived toggle only Restores (Archiving happens from the
// Item detail page) — uses lib/item/'s dedicated restoreItem, not a new
// mutation (#38).
export async function restoreItemAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    return;
  }

  await restoreItem(prisma, { actorUserId: session.user.id, itemId });
  revalidatePath(listPath(workspaceId, listId));
}

// The List view's row checkbox (design-mocks/list-view) — the same
// lib/item mutation the Item detail page's State control and My Tasks'
// row checkbox use, so completing an Item here is visible everywhere else
// it appears (#42's "same row, not a copy" precedent).
export async function completeItemAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    return;
  }

  await transitionItemState(prisma, { actorUserId: session.user.id, itemId, state: "COMPLETE" });
  revalidatePath(listPath(workspaceId, listId));
}

export async function setBoardGroupByAction(
  workspaceId: string,
  listId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const groupBy = String(formData.get("groupBy") ?? "");

  await setBoardGroupBy(prisma, { actorUserId: session.user.id, listId, groupBy });
  revalidatePath(listPath(workspaceId, listId));
}

export async function moveItemToColumnAction(
  workspaceId: string,
  listId: string,
  groupBy: string,
  itemId: string,
  columnKey: string,
  blockerReason?: string
): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));

  if (!isValidBoardGroupBy(groupBy)) {
    return;
  }

  await moveItemToColumn(prisma, {
    actorUserId: session.user.id,
    itemId,
    groupBy: groupBy as BoardGroupBy,
    columnKey,
    blockerReason,
  });
  revalidatePath(listPath(workspaceId, listId));
}

// Dashboard's Peer Comparison switch (#58) — workspace-level, so it's read
// fresh here rather than trusting a client-supplied prior value, and
// forbidden for anyone but a Workspace Owner/Admin (enforced in
// setPeerComparisonEnabled itself, not just hidden in the UI).
export async function togglePeerComparisonAction(workspaceId: string, listId: string): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { peerComparisonEnabled: true },
  });

  await setPeerComparisonEnabled(prisma, {
    userId: session.user.id,
    workspaceId,
    enabled: !workspace.peerComparisonEnabled,
  });
  revalidatePath(listPath(workspaceId, listId));
}
