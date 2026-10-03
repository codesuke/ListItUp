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
