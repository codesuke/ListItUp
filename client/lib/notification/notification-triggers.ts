import { randomUUID } from "node:crypto";

import type { ItemState, PrismaClient } from "@/generated/prisma/client";
import { excludingMutedRecipients } from "@/lib/notification/notification-preferences";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

// "Approaching" has no pinned value anywhere in the spec/QnA — a 24h window
// is an implementation-time call, not a durable contract (mirrors the
// "Items I've Assigned" precedent in docs/Specs-Planned). A completed or
// archived Item never gets a reminder; there is nothing left to do.
export const DUE_DATE_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const REMINDABLE_STATES: readonly ItemState[] = [
  "TO_DO",
  "IN_PROGRESS",
  "BLOCKED",
];

async function getItemAssigneeIds(
  database: PrismaClient,
  itemId: string
): Promise<string[]> {
  const assignees = await database.itemAssignee.findMany({
    where: { itemId },
    select: { userId: true },
  });
  return assignees.map((assignee) => assignee.userId);
}

// Never notify a User about their own action — every trigger below excludes
// actorUserId from its recipient list.
function excludingActor(userIds: string[], actorUserId: string): string[] {
  return userIds.filter((userId) => userId !== actorUserId);
}

export async function notifyAssigneeAdded(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; assigneeUserId: string }
): Promise<void> {
  const { actorUserId, itemId, assigneeUserId } = input;
  if (assigneeUserId === actorUserId) {
    return;
  }

  const recipients = await excludingMutedRecipients(database, {
    recipientIds: [assigneeUserId],
    type: "ASSIGNEE_ADDED",
  });
  if (recipients.length === 0) {
    return;
  }

  await database.notification.create({
    data: {
      id: randomUUID(),
      recipientId: assigneeUserId,
      type: "ASSIGNEE_ADDED",
      itemId,
      actorId: actorUserId,
    },
  });
}

export async function notifyAssigneeRemoved(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; assigneeUserId: string }
): Promise<void> {
  const { actorUserId, itemId, assigneeUserId } = input;
  if (assigneeUserId === actorUserId) {
    return;
  }

  const recipients = await excludingMutedRecipients(database, {
    recipientIds: [assigneeUserId],
    type: "ASSIGNEE_REMOVED",
  });
  if (recipients.length === 0) {
    return;
  }

  await database.notification.create({
    data: {
      id: randomUUID(),
      recipientId: assigneeUserId,
      type: "ASSIGNEE_REMOVED",
      itemId,
      actorId: actorUserId,
    },
  });
}

// Two independent recipient sets for one Note: its Item's Assignees (who
// care that the Item they own moved) get NOTE_ADDED, and the Users named in
// mentionedUserIds get MENTIONED — a User who is both gets one of each,
// since they answer different questions ("did anything happen on my Item?"
// vs. "was I addressed directly?", see @Mentioned tab in CONTEXT.md).
// mentionedUserIds is re-resolved against the Item's access list here via
// resolveItemAccess rather than trusted from the caller, so this trigger
// stays correct even if a future caller skips createNote's own check (#41).
export async function notifyNoteCreated(
  database: PrismaClient,
  input: {
    actorUserId: string;
    itemId: string;
    noteId: string;
    mentionedUserIds?: string[];
  }
): Promise<void> {
  const { actorUserId, itemId, noteId } = input;

  const assigneeIds = await getItemAssigneeIds(database, itemId);
  const noteRecipients = await excludingMutedRecipients(database, {
    recipientIds: excludingActor(assigneeIds, actorUserId),
    type: "NOTE_ADDED",
  });
  await Promise.all(
    noteRecipients.map((recipientId) =>
      database.notification.create({
        data: {
          id: randomUUID(),
          recipientId,
          type: "NOTE_ADDED",
          itemId,
          actorId: actorUserId,
          noteId,
        },
      })
    )
  );

  const mentionedUserIds = excludingActor(
    [...new Set(input.mentionedUserIds ?? [])],
    actorUserId
  );
  const accessByUserId = await Promise.all(
    mentionedUserIds.map(async (userId) => {
      const access = await resolveItemAccess(database, { userId, itemId });
      return { userId, hasAccess: meetsListAccessLevel(access, "READ") };
    })
  );
  const mentionRecipients = await excludingMutedRecipients(database, {
    recipientIds: accessByUserId
      .filter((entry) => entry.hasAccess)
      .map((entry) => entry.userId),
    type: "MENTIONED",
  });

  await Promise.all(
    mentionRecipients.map((recipientId) =>
      database.notification.create({
        data: {
          id: randomUUID(),
          recipientId,
          type: "MENTIONED",
          itemId,
          actorId: actorUserId,
          noteId,
        },
      })
    )
  );
}

// Recipients are the Item's Assignees, who are accountable for the Item's
// progress (CONTEXT.md Assignee) — not every List Member, to keep this from
// becoming list-wide broadcast noise.
export async function notifyItemStateChanged(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string }
): Promise<void> {
  const { actorUserId, itemId } = input;

  const assigneeIds = await getItemAssigneeIds(database, itemId);
  const recipients = await excludingMutedRecipients(database, {
    recipientIds: excludingActor(assigneeIds, actorUserId),
    type: "STATE_CHANGED",
  });
  await Promise.all(
    recipients.map((recipientId) =>
      database.notification.create({
        data: {
          id: randomUUID(),
          recipientId,
          type: "STATE_CHANGED",
          itemId,
          actorId: actorUserId,
        },
      })
    )
  );
}

// Pure trigger-condition check, separated from the DB round trip below so
// it can be unit-tested without a Prisma client.
export function isDueDateApproaching(
  item: { dueDate: Date | null; state: ItemState },
  now: Date,
  windowMs: number = DUE_DATE_REMINDER_WINDOW_MS
): boolean {
  if (!item.dueDate || !REMINDABLE_STATES.includes(item.state)) {
    return false;
  }

  const msUntilDue = item.dueDate.getTime() - now.getTime();
  return msUntilDue >= 0 && msUntilDue <= windowMs;
}

// Invoked on a schedule by POST /api/internal/due-date-reminders (#53).
// Idempotent per approaching deadline via the recipientId/itemId/type/
// dueDateAt unique constraint on Notification: re-running this against the
// same Item/Assignee/dueDate is a no-op, so a one-time-per-deadline
// reminder never turns into a recurrence engine (#41). If an Item's dueDate
// is edited, dueDateAt no longer matches the stored reminder and a fresh
// one can fire for the new date.
export async function createDueDateReminders(
  database: PrismaClient,
  input: { now: Date; windowMs?: number }
): Promise<{ remindersCreated: number }> {
  const windowMs = input.windowMs ?? DUE_DATE_REMINDER_WINDOW_MS;
  const upperBound = new Date(input.now.getTime() + windowMs);

  const items = await database.item.findMany({
    where: {
      dueDate: { gte: input.now, lte: upperBound },
      state: { in: [...REMINDABLE_STATES] },
    },
    select: {
      id: true,
      dueDate: true,
      assignees: { select: { userId: true } },
    },
  });

  let remindersCreated = 0;
  for (const item of items) {
    if (!item.dueDate) {
      continue;
    }

    const recipients = await excludingMutedRecipients(database, {
      recipientIds: item.assignees.map((assignee) => assignee.userId),
      type: "DUE_DATE_REMINDER",
    });

    for (const recipientId of recipients) {
      const dedupeKey = {
        recipientId,
        itemId: item.id,
        type: "DUE_DATE_REMINDER" as const,
        dueDateAt: item.dueDate,
      };
      const alreadyReminded = await database.notification.findUnique({
        where: { recipientId_itemId_type_dueDateAt: dedupeKey },
        select: { id: true },
      });
      await database.notification.upsert({
        where: { recipientId_itemId_type_dueDateAt: dedupeKey },
        create: { id: randomUUID(), ...dedupeKey },
        update: {},
      });
      if (!alreadyReminded) {
        remindersCreated += 1;
      }
    }
  }

  return { remindersCreated };
}
