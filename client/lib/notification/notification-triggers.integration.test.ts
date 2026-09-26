import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { addAssignee, removeAssignee } from "@/lib/item/item-assignment";
import { transitionItemState } from "@/lib/item/item-lifecycle";
import { createNote } from "@/lib/item/item-notes";

import { setCategoryMuted } from "./notification-preferences";
import {
  createDueDateReminders,
  notifyNoteCreated,
} from "./notification-triggers";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "notification triggers integration test skipped: DATABASE_URL is not set"
    );
    return;
  }

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: {
        id: userId,
        name: "Test User",
        email: `notification-${userId}@example.test`,
      },
    });
    return userId;
  }

  async function createWorkspaceWithList(): Promise<{
    workspaceId: string;
    listId: string;
  }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: { id: workspaceId, name: "Test Workspace" },
    });
    await prisma.list.create({
      data: { id: listId, workspaceId, name: "Test List" },
    });
    return { workspaceId, listId };
  }

  async function addListMember(
    workspaceId: string,
    listId: string,
    role: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<string> {
    const userId = await createUser();
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" },
    });
    await prisma.listMember.create({
      data: { id: randomUUID(), listId, userId, role },
    });
    return userId;
  }

  async function createTestItem(
    listId: string,
    creatorId: string,
    extra: {
      dueDate?: Date;
      state?: "TO_DO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" | "ARCHIVED";
    } = {}
  ): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({
      data: {
        id: itemId,
        listId,
        title: "Test Item",
        creatorId,
        dueDate: extra.dueDate,
        state: extra.state,
      },
    });
    return itemId;
  }

  try {
    // Adding an Assignee notifies the newly assigned User, not the actor
    // who made the change.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const actorId = await addListMember(workspaceId, listId);
      const assigneeId = await addListMember(workspaceId, listId);
      const itemId = await createTestItem(listId, actorId);

      await addAssignee(prisma, {
        actorUserId: actorId,
        itemId,
        userId: assigneeId,
      });

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "ASSIGNEE_ADDED" },
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.recipientId, assigneeId);
      assert.equal(notifications[0]?.actorId, actorId);
      assert.equal(notifications[0]?.readAt, null);
      assert.equal(notifications[0]?.bookmarkedAt, null);
      assert.equal(notifications[0]?.archivedAt, null);
    }

    // A User assigning themselves gets no notification about their own
    // action.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const actorId = await addListMember(workspaceId, listId);
      const itemId = await createTestItem(listId, actorId);

      await addAssignee(prisma, {
        actorUserId: actorId,
        itemId,
        userId: actorId,
      });

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "ASSIGNEE_ADDED" },
      });
      assert.equal(notifications.length, 0);
    }

    // Removing an Assignee notifies the removed User.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const actorId = await addListMember(workspaceId, listId);
      const assigneeId = await addListMember(workspaceId, listId);
      const itemId = await createTestItem(listId, actorId);
      await addAssignee(prisma, {
        actorUserId: actorId,
        itemId,
        userId: assigneeId,
      });

      await removeAssignee(prisma, {
        actorUserId: actorId,
        itemId,
        userId: assigneeId,
      });

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "ASSIGNEE_REMOVED" },
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.recipientId, assigneeId);
    }

    // Creating a Note notifies the Item's Assignees (excluding the Note's
    // author) with NOTE_ADDED.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const authorId = await addListMember(workspaceId, listId);
      const assigneeId = await addListMember(workspaceId, listId);
      const itemId = await createTestItem(listId, authorId);
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId, userId: authorId },
      });
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId, userId: assigneeId },
      });

      const result = await createNote(prisma, {
        actorUserId: authorId,
        itemId,
        body: "Status update.",
      });
      assert.equal(result.status, "created");

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "NOTE_ADDED" },
      });
      assert.equal(
        notifications.length,
        1,
        "the author, also an Assignee, does not notify themselves"
      );
      assert.equal(notifications[0]?.recipientId, assigneeId);
      assert.equal(
        notifications[0]?.noteId,
        result.status === "created" ? result.noteId : undefined
      );
    }

    // Mentioning a User who already has access to the Note's Item notifies
    // them with MENTIONED, distinct from NOTE_ADDED.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const authorId = await addListMember(workspaceId, listId);
      const mentionedId = await addListMember(workspaceId, listId, "VIEWER");
      const itemId = await createTestItem(listId, authorId);

      const result = await createNote(prisma, {
        actorUserId: authorId,
        itemId,
        body: "Looping you in.",
        mentionedUserIds: [mentionedId],
      });
      assert.equal(result.status, "created");

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "MENTIONED" },
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.recipientId, mentionedId);
    }

    // notifyNoteCreated re-resolves mention access itself via
    // lib/permissions/ rather than trusting its caller: a mentioned User
    // without Item access gets no MENTIONED notification, even when this
    // trigger is invoked directly.
    {
      const { listId } = await createWorkspaceWithList();
      const authorId = await createUser();
      const outsiderId = await createUser();
      const itemId = await createTestItem(listId, authorId);
      const note = await prisma.note.create({
        data: {
          id: randomUUID(),
          itemId,
          authorId,
          body: "Not really mentionable.",
        },
      });

      await notifyNoteCreated(prisma, {
        actorUserId: authorId,
        itemId,
        noteId: note.id,
        mentionedUserIds: [outsiderId],
      });

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "MENTIONED" },
      });
      assert.equal(notifications.length, 0);
    }

    // Transitioning an Item's lifecycle state notifies its Assignees
    // (excluding the actor) with STATE_CHANGED.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const actorId = await addListMember(workspaceId, listId);
      const assigneeId = await addListMember(workspaceId, listId);
      const itemId = await createTestItem(listId, actorId);
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId, userId: actorId },
      });
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId, userId: assigneeId },
      });

      const result = await transitionItemState(prisma, {
        actorUserId: actorId,
        itemId,
        state: "IN_PROGRESS",
      });
      assert.deepEqual(result, { status: "transitioned" });

      const notifications = await prisma.notification.findMany({
        where: { itemId, type: "STATE_CHANGED" },
      });
      assert.equal(
        notifications.length,
        1,
        "the actor, also an Assignee, does not notify themselves"
      );
      assert.equal(notifications[0]?.recipientId, assigneeId);
    }

    // createDueDateReminders notifies every Assignee of an Item whose
    // dueDate falls inside the approaching window, and skips Items outside
    // it (too far away, already past, or COMPLETE/ARCHIVED).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const creatorId = await addListMember(workspaceId, listId);
      const assigneeId = await addListMember(workspaceId, listId);
      const now = new Date("2026-09-15T12:00:00.000Z");
      const windowMs = 24 * 60 * 60 * 1000;

      const approachingItemId = await createTestItem(listId, creatorId, {
        dueDate: new Date(now.getTime() + windowMs / 2),
        state: "TO_DO",
      });
      await prisma.itemAssignee.create({
        data: {
          id: randomUUID(),
          itemId: approachingItemId,
          userId: assigneeId,
        },
      });

      const farItemId = await createTestItem(listId, creatorId, {
        dueDate: new Date(now.getTime() + windowMs * 10),
        state: "TO_DO",
      });
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId: farItemId, userId: assigneeId },
      });

      const completedItemId = await createTestItem(listId, creatorId, {
        dueDate: new Date(now.getTime() + windowMs / 2),
        state: "COMPLETE",
      });
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId: completedItemId, userId: assigneeId },
      });

      const firstRun = await createDueDateReminders(prisma, { now, windowMs });

      const reminders = await prisma.notification.findMany({
        where: { recipientId: assigneeId, type: "DUE_DATE_REMINDER" },
      });
      assert.equal(reminders.length, 1);
      assert.equal(reminders[0]?.itemId, approachingItemId);
      assert.equal(firstRun.remindersCreated, 1);

      // Idempotent: running the schedule again for the same moment creates
      // no duplicate reminder for the same Item/Assignee/dueDate, and its
      // summary count reflects that nothing new was created (#53).
      const secondRun = await createDueDateReminders(prisma, { now, windowMs });
      const remindersAfterRerun = await prisma.notification.findMany({
        where: { recipientId: assigneeId, type: "DUE_DATE_REMINDER" },
      });
      assert.equal(
        remindersAfterRerun.length,
        1,
        "re-running the schedule must not duplicate the reminder"
      );
      assert.equal(secondRun.remindersCreated, 0);
    }

    // A recipient who has muted a NotificationType's category gets no new
    // notification row of that type, checked here at trigger time (#48) —
    // other, un-muted types for the same recipient are unaffected.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const actorId = await addListMember(workspaceId, listId);
      const assigneeId = await addListMember(workspaceId, listId);
      const itemId = await createTestItem(listId, actorId);
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId, userId: assigneeId },
      });

      await setCategoryMuted(prisma, {
        userId: assigneeId,
        category: "state",
        muted: true,
      });

      const stateResult = await transitionItemState(prisma, {
        actorUserId: actorId,
        itemId,
        state: "IN_PROGRESS",
      });
      assert.deepEqual(stateResult, { status: "transitioned" });
      const stateNotifications = await prisma.notification.findMany({
        where: { itemId, type: "STATE_CHANGED" },
      });
      assert.equal(
        stateNotifications.length,
        0,
        "a muted category must produce no notification row"
      );

      const noteResult = await createNote(prisma, {
        actorUserId: actorId,
        itemId,
        body: "Still notified?",
      });
      assert.equal(noteResult.status, "created");
      const noteNotifications = await prisma.notification.findMany({
        where: { itemId, type: "NOTE_ADDED" },
      });
      assert.equal(
        noteNotifications.length,
        1,
        "an un-muted category for the same recipient is unaffected"
      );
      assert.equal(noteNotifications[0]?.recipientId, assigneeId);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({
        where: { workspaceId: { in: createdWorkspaceIds } },
      })
    ).map((list) => list.id);
    await prisma.notification.deleteMany({
      where: { item: { listId: { in: listIds } } },
    });
    await prisma.mutedNotificationType.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.mention.deleteMany({
      where: { note: { item: { listId: { in: listIds } } } },
    });
    await prisma.note.deleteMany({
      where: { item: { listId: { in: listIds } } },
    });
    await prisma.itemAssignee.deleteMany({
      where: { item: { listId: { in: listIds } } },
    });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: createdWorkspaceIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("notification triggers integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
