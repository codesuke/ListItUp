"use server";

import { revalidatePath } from "next/cache";

import { isValidMyTasksBoardGroupBy, moveMyTaskItemToColumn } from "@/lib/item/item-my-tasks-board";
import { createItemFromQuickAdd, type CreateItemFromQuickAddResult } from "@/lib/item/item-quick-add";
import { transitionItemState } from "@/lib/item/item-lifecycle";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

const MY_TASKS_PATH = "/my-tasks";

// Completing an Item from My Tasks calls the same lib/item mutation used
// on the Item detail page and Board — the Item updates everywhere else it
// appears because it's the same row, not a copy (#42).
export async function completeMyTaskItemAction(itemId: string): Promise<void> {
  const session = await requireAuthenticatedSession(MY_TASKS_PATH);
  await transitionItemState(prisma, { actorUserId: session.user.id, itemId, state: "COMPLETE" });
  revalidatePath(MY_TASKS_PATH);
}

export type QuickAddItemState =
  | { status: "idle" }
  | { status: "created" }
  | { status: "error"; message: string };

const QUICK_ADD_ERROR_MESSAGES: Record<
  Exclude<CreateItemFromQuickAddResult["status"], "created" | "empty-title">,
  string
> = {
  "no-inbox-list": "Couldn't find your Inbox list — try again in a moment.",
  "list-not-found": "That list doesn't exist anymore.",
  forbidden: "You don't have permission to add tasks there.",
};

// Quick-Add's capture box (#45) — parses shorthand out of the typed text
// and creates the Item through lib/item/item-quick-add.ts, which itself
// calls lib/item/'s existing createItem rather than a parallel path. An
// empty or shorthand-only submission is a silent no-op, same as the List
// page's "Add an Item" form handles a blank title. Any other non-"created"
// result is a real failure (missing Inbox, a stale List, no access) and is
// surfaced to the caller rather than discarded — previously the typed text
// just vanished on Enter with nothing visibly created, because this action
// ignored createItemFromQuickAdd's result entirely. This is Add Task's
// (#44) implementation — no separate Quick-Add path is added here.
export async function quickAddItemAction(
  _prevState: QuickAddItemState,
  formData: FormData
): Promise<QuickAddItemState> {
  const session = await requireAuthenticatedSession(MY_TASKS_PATH);
  const text = String(formData.get("quickAddText") ?? "").trim();

  if (!text) {
    return { status: "idle" };
  }

  const result = await createItemFromQuickAdd(prisma, { actorUserId: session.user.id, text });
  if (result.status === "empty-title") {
    return { status: "idle" };
  }
  if (result.status !== "created") {
    return { status: "error", message: QUICK_ADD_ERROR_MESSAGES[result.status] };
  }

  revalidatePath(MY_TASKS_PATH);
  return { status: "created" };
}

// Moving a card on My Tasks' Board dispatches through the same lib/item
// mutations as the List page's Board move (#43) — see
// moveMyTaskItemToColumn in lib/item/item-my-tasks-board.ts for why that's
// safe across Workspaces without extra checks here.
export async function moveMyTaskItemAction(
  groupBy: string,
  itemId: string,
  columnKey: string,
  blockerReason?: string
): Promise<void> {
  const session = await requireAuthenticatedSession(MY_TASKS_PATH);

  if (!isValidMyTasksBoardGroupBy(groupBy)) {
    return;
  }

  await moveMyTaskItemToColumn(prisma, {
    actorUserId: session.user.id,
    itemId,
    groupBy,
    columnKey,
    blockerReason,
  });
  revalidatePath(MY_TASKS_PATH);
}
