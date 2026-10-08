import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { notifyNoteCreated } from "@/lib/notification/notification-triggers";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

// A List Member, Lead, or the Workspace Owner, with write access to the
// Item can add a Note to it (#37).
const REQUIRED_ACCESS_LEVEL = "WRITE";

export type CreateNoteResult =
  | { status: "created"; noteId: string }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "mention-not-allowed"; userId: string }
  | { status: "list-archived" };

// Mentioning cannot be used to leak visibility: every mentioned User must
// already have (at least read) access to the Note's Item, checked through
// the same resolveItemAccess() every other authorization check in this
// module uses — never a separate ad hoc membership query (#37).
export async function createNote(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; body: string; mentionedUserIds?: string[] }
): Promise<CreateNoteResult> {
  const { actorUserId, itemId, body } = input;
  const mentionedUserIds = [...new Set(input.mentionedUserIds ?? [])];

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

  for (const mentionedUserId of mentionedUserIds) {
    const mentionedAccess = await resolveItemAccess(database, { userId: mentionedUserId, itemId });
    if (!meetsListAccessLevel(mentionedAccess, "READ")) {
      return { status: "mention-not-allowed", userId: mentionedUserId };
    }
  }

  const noteId = randomUUID();
  await database.note.create({
    data: {
      id: noteId,
      itemId,
      authorId: actorUserId,
      body,
      mentions: {
        create: mentionedUserIds.map((userId) => ({ id: randomUUID(), userId })),
      },
    },
  });
  await notifyNoteCreated(database, { actorUserId, itemId, noteId, mentionedUserIds });

  return { status: "created", noteId };
}

export type UpsertPersonalNoteResult =
  | { status: "ok" }
  | { status: "item-not-found" }
  | { status: "not-assignee" };

// Scoped to the owning User only — an Assignee of the Item can keep private
// planning context here without touching the shared Item or its
// team-visible Notes (#37). Not gated by the WRITE access level above: an
// Assignee who is only a List Viewer can still keep their own
// Personal Note, since it never touches the shared Item.
export async function upsertPersonalNote(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; body: string }
): Promise<UpsertPersonalNoteResult> {
  const { actorUserId, itemId, body } = input;

  const item = await database.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { status: "item-not-found" };
  }

  const assignee = await database.itemAssignee.findUnique({
    where: { itemId_userId: { itemId, userId: actorUserId } },
  });
  if (!assignee) {
    return { status: "not-assignee" };
  }

  await database.personalNote.upsert({
    where: { itemId_userId: { itemId, userId: actorUserId } },
    create: { id: randomUUID(), itemId, userId: actorUserId, body },
    update: { body },
  });

  return { status: "ok" };
}

// Never surfaced on the shared Item to anyone but its owner — callers pass
// the current session's userId as actorUserId, so there is no separate
// visibility check to bypass (#37).
export async function getPersonalNote(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string }
): Promise<{ body: string } | null> {
  const note = await database.personalNote.findUnique({
    where: { itemId_userId: { itemId: input.itemId, userId: input.actorUserId } },
  });
  return note ? { body: note.body } : null;
}
