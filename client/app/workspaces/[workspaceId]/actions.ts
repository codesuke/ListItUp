"use server";

import { revalidatePath } from "next/cache";

import { transitionItemState } from "@/lib/item/item-lifecycle";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

// Completing an Item from the Home "My Tasks" preview calls the same
// lib/item mutation used on My Tasks, the Item detail page, and the Board —
// the Item updates everywhere else it appears because it's the same row,
// not a copy (#42).
export async function completeHomeTaskItemAction(workspaceId: string, itemId: string): Promise<void> {
  const homePath = `/workspaces/${workspaceId}`;
  const session = await requireAuthenticatedSession(homePath);
  await transitionItemState(prisma, { actorUserId: session.user.id, itemId, state: "COMPLETE" });
  revalidatePath(homePath);
}

// The checkbox's other direction — completing an Item here was a one-way
// door (once checked, the row rendered a static checkmark with no control
// left to click), so a mis-click or a change of mind had no way back
// short of opening the Item and changing its Status there. Reopening
// always lands on TO_DO rather than whatever state preceded COMPLETE —
// the Item has no stored "state before complete" the way Archive does
// (stateBeforeArchive) — same fallback restoreItem itself uses when that
// history is missing.
export async function uncompleteHomeTaskItemAction(workspaceId: string, itemId: string): Promise<void> {
  const homePath = `/workspaces/${workspaceId}`;
  const session = await requireAuthenticatedSession(homePath);
  await transitionItemState(prisma, { actorUserId: session.user.id, itemId, state: "TO_DO" });
  revalidatePath(homePath);
}
