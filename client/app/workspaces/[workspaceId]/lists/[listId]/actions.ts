"use server";

import { revalidatePath } from "next/cache";

import type { ListMemberRole } from "@/generated/prisma/client";
import { createItem } from "@/lib/item/item-creation";
import { restoreItem, transitionItemState } from "@/lib/item/item-lifecycle";
import { isValidBoardGroupBy, moveItemToColumn, setBoardGroupBy, type BoardGroupBy } from "@/lib/list/list-board";
import { addListAccessByEmail, type ListAccessByEmailRole } from "@/lib/list/list-access-by-email";
import { revokeGuestAccess } from "@/lib/list/list-guests";
import { setListStatus, updateListDescription } from "@/lib/list/list-lifecycle";
import { addListMember, changeListMemberRole, removeListMember } from "@/lib/list/list-membership";
import { moveListRoleAssignment, type ListRoleBoardRole } from "@/lib/list/list-role-board";
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

// The Manage Access email field's role selector — Lead stays out of scope
// here too, same reasoning as ADDABLE_ROLES above.
const EMAIL_ADDABLE_ROLES: readonly ListAccessByEmailRole[] = ["MEMBER", "VIEWER", "GUEST"];

// The Roles kanban can drag a person into any of the four columns, Lead
// included — unlike the two role selectors above, this interaction is
// gated at the LEAD threshold by moveListRoleAssignment itself, so a
// coarser, full set of destinations is safe to expose.
const DRAGGABLE_ROLES: readonly ListRoleBoardRole[] = ["LEAD", "MEMBER", "VIEWER", "GUEST"];

// A guarded Roles-panel mutation's outcome for the client: either it went
// through, or it didn't and the UI has a message to show (most commonly
// #95's "last-lead" block on removing/demoting/stepping down a List's only
// Lead).
export type ListRoleActionResult = { status: "ok" } | { status: "error"; message: string };

const LAST_LEAD_MESSAGE = "This List must always have at least one Lead — promote someone else to Lead first.";
const LIST_NOT_FOUND_MESSAGE = "This List no longer exists.";
const VIEWER_CEILING_MESSAGE = "A Workspace Viewer can only be a List Viewer — change their Workspace role first.";
const LIST_ARCHIVED_MESSAGE = "This List is archived and read-only — restore it first.";

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

const ADD_LIST_MEMBER_ERROR_MESSAGE = {
  "list-not-found": LIST_NOT_FOUND_MESSAGE,
  forbidden: "You don't have permission to add members to this List.",
  "user-lacks-workspace-membership": "That person must join the Workspace first.",
  "viewer-ceiling": VIEWER_CEILING_MESSAGE,
  "list-archived": LIST_ARCHIVED_MESSAGE,
} as const;

export async function addListMemberAction(
  workspaceId: string,
  listId: string,
  _prevState: ListRoleActionResult,
  formData: FormData
): Promise<ListRoleActionResult> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const targetUserId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!targetUserId || !ADDABLE_ROLES.includes(role as ListMemberRole)) {
    return { status: "ok" };
  }

  const result = await addListMember(prisma, {
    actorUserId: session.user.id,
    listId,
    userId: targetUserId,
    role: role as ListMemberRole,
  });

  if (result.status !== "added") {
    return { status: "error", message: ADD_LIST_MEMBER_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(listPath(workspaceId, listId));
  return { status: "ok" };
}

const REMOVE_LIST_MEMBER_ERROR_MESSAGE = {
  "list-not-found": LIST_NOT_FOUND_MESSAGE,
  forbidden: "You don't have permission to remove members from this List.",
  "last-lead": LAST_LEAD_MESSAGE,
  "list-archived": LIST_ARCHIVED_MESSAGE,
} as const;

export async function removeListMemberAction(
  workspaceId: string,
  listId: string,
  targetUserId: string
): Promise<ListRoleActionResult> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const result = await removeListMember(prisma, { actorUserId: session.user.id, listId, userId: targetUserId });

  if (result.status !== "removed") {
    return { status: "error", message: REMOVE_LIST_MEMBER_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(listPath(workspaceId, listId));
  return { status: "ok" };
}

const CHANGE_LIST_MEMBER_ROLE_ERROR_MESSAGE = {
  "list-not-found": LIST_NOT_FOUND_MESSAGE,
  forbidden: "You don't have permission to change roles in this List.",
  "member-not-found": "That person is no longer part of this List.",
  "last-lead": LAST_LEAD_MESSAGE,
  "viewer-ceiling": VIEWER_CEILING_MESSAGE,
  "list-archived": LIST_ARCHIVED_MESSAGE,
} as const;

// The Roles panel's "Make Lead" button — promotes a Member/Viewer to Lead.
// Promotion never strands a Lead, so changeListMemberRole never blocks it,
// but it shares the same guarded path as demotion/step-down below (#95).
export async function promoteListMemberToLeadAction(
  workspaceId: string,
  listId: string,
  targetUserId: string
): Promise<ListRoleActionResult> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const result = await changeListMemberRole(prisma, {
    actorUserId: session.user.id,
    listId,
    userId: targetUserId,
    role: "LEAD",
  });

  if (result.status !== "changed") {
    return { status: "error", message: CHANGE_LIST_MEMBER_ROLE_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(listPath(workspaceId, listId));
  return { status: "ok" };
}

// The Roles panel's "Step down" button, shown only on the viewer's own Lead
// row — a Lead handover is promote-then-step-down, with no dedicated
// "transfer Lead" action (#95).
export async function stepDownFromListLeadAction(
  workspaceId: string,
  listId: string,
  targetUserId: string
): Promise<ListRoleActionResult> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const result = await changeListMemberRole(prisma, {
    actorUserId: session.user.id,
    listId,
    userId: targetUserId,
    role: "MEMBER",
  });

  if (result.status !== "changed") {
    return { status: "error", message: CHANGE_LIST_MEMBER_ROLE_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(listPath(workspaceId, listId));
  return { status: "ok" };
}

const ADD_LIST_ACCESS_BY_EMAIL_ERROR_MESSAGE = {
  "list-not-found": LIST_NOT_FOUND_MESSAGE,
  forbidden: "You don't have permission to add members to this List.",
  "user-not-found": "No account exists for that email.",
  "user-lacks-workspace-membership": "That person must join the Workspace first.",
  "viewer-ceiling": VIEWER_CEILING_MESSAGE,
  "list-archived": LIST_ARCHIVED_MESSAGE,
} as const;

export async function addListAccessByEmailAction(
  workspaceId: string,
  listId: string,
  _prevState: ListRoleActionResult,
  formData: FormData
): Promise<ListRoleActionResult> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!email || !EMAIL_ADDABLE_ROLES.includes(role as ListAccessByEmailRole)) {
    return { status: "ok" };
  }

  const result = await addListAccessByEmail(prisma, {
    actorUserId: session.user.id,
    listId,
    email,
    role: role as ListAccessByEmailRole,
  });

  if (result.status !== "added") {
    return { status: "error", message: ADD_LIST_ACCESS_BY_EMAIL_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(listPath(workspaceId, listId));
  return { status: "ok" };
}

const MOVE_LIST_ROLE_ERROR_MESSAGE = {
  "list-not-found": LIST_NOT_FOUND_MESSAGE,
  forbidden: "You don't have permission to do that.",
  "user-lacks-workspace-membership": "That person must join the Workspace first.",
  "last-lead": LAST_LEAD_MESSAGE,
  "list-archived": LIST_ARCHIVED_MESSAGE,
} as const;

// The Roles kanban's drag-and-drop (LEAD threshold, same as the panel's
// other controls — enforced in moveListRoleAssignment itself, not just by
// hiding the drag handle).
export async function moveListRoleAssignmentAction(
  workspaceId: string,
  listId: string,
  targetUserId: string,
  toRole: string
): Promise<ListRoleActionResult> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));

  if (!DRAGGABLE_ROLES.includes(toRole as ListRoleBoardRole)) {
    return { status: "ok" };
  }

  const result = await moveListRoleAssignment(prisma, {
    actorUserId: session.user.id,
    listId,
    userId: targetUserId,
    toRole: toRole as ListRoleBoardRole,
  });

  if (result.status !== "moved") {
    return { status: "error", message: MOVE_LIST_ROLE_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(listPath(workspaceId, listId));
  return { status: "ok" };
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

// The checkbox's other direction — completing an Item here was a one-way
// door (once checked, the row rendered a static checkmark with no control
// left to click), so a mis-click or a change of mind had no way back short
// of opening the Item and changing its Status there. Reopening always
// lands on TO_DO rather than whatever state preceded COMPLETE — the Item
// has no stored "state before complete" the way Archive does
// (stateBeforeArchive) — same fallback restoreItem itself uses when that
// history is missing.
export async function uncompleteItemAction(workspaceId: string, listId: string, formData: FormData): Promise<void> {
  const session = await requireAuthenticatedSession(listPath(workspaceId, listId));
  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    return;
  }

  await transitionItemState(prisma, { actorUserId: session.user.id, itemId, state: "TO_DO" });
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
