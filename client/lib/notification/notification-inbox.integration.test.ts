import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  archiveNotification,
  countUnreadNotifications,
  loadActivityNotifications,
  loadArchivedNotifications,
  loadBookmarkedNotifications,
  loadMentionedNotifications,
  markNotificationRead,
  toggleNotificationBookmark,
} from "./notification-inbox";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("notification inbox integration test skipped: DATABASE_URL is not set");
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

  async function createUser(name = "Test User"): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({ data: { id: userId, name, email: `notification-inbox-${userId}@example.test` } });
    return userId;
  }

  async function createWorkspaceWithItem(): Promise<{
    itemId: string;
    creatorId: string;
    listId: string;
    workspaceId: string;
  }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    const creatorId = await createUser("Actor");
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title: "Ship the release", creatorId } });
    return { itemId, creatorId, listId, workspaceId };
  }

  // Every loader re-checks the recipient's current List access (#107/ADR
  // 0021), so a recipient fixture needs an explicit grant to see an
  // Item-anchored notification at all.
  async function grantListAccess(workspaceId: string, listId: string, userId: string): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "MEMBER" } });
  }

  async function createNotification(input: {
    recipientId: string;
    actorId?: string;
    itemId: string;
    type: "ASSIGNEE_ADDED" | "ASSIGNEE_REMOVED" | "NOTE_ADDED" | "MENTIONED" | "STATE_CHANGED" | "DUE_DATE_REMINDER";
    readAt?: Date;
    archivedAt?: Date;
    bookmarkedAt?: Date;
  }): Promise<string> {
    const id = randomUUID();
    await prisma.notification.create({
      data: {
        id,
        recipientId: input.recipientId,
        actorId: input.actorId,
        itemId: input.itemId,
        type: input.type,
        readAt: input.readAt,
        archivedAt: input.archivedAt,
        bookmarkedAt: input.bookmarkedAt,
      },
    });
    return id;
  }

  try {
    // loadActivityNotifications returns only the recipient's own
    // notifications, newest first, and excludes DUE_DATE_REMINDER (out of
    // the Activity tab's scope per #47) and archived notifications.
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);
      const otherUserId = await createUser("Someone Else");

      const older = await createNotification({ recipientId, actorId: creatorId, itemId, type: "ASSIGNEE_ADDED" });
      await prisma.notification.update({
        where: { id: older },
        data: { createdAt: new Date(Date.now() - 60_000) },
      });
      const newer = await createNotification({ recipientId, actorId: creatorId, itemId, type: "NOTE_ADDED" });
      await createNotification({ recipientId: otherUserId, actorId: creatorId, itemId, type: "ASSIGNEE_ADDED" });
      await createNotification({ recipientId, actorId: creatorId, itemId, type: "DUE_DATE_REMINDER" });
      await createNotification({ recipientId, actorId: creatorId, itemId, type: "STATE_CHANGED", archivedAt: new Date() });

      const notifications = await loadActivityNotifications(prisma, { recipientId });

      assert.deepEqual(
        notifications.map((n) => n.id),
        [newer, older],
        "expected newest-first order, own notifications only, reminders and archived excluded"
      );
      assert.equal(notifications[0]?.actorName, "Actor");
      assert.equal(notifications[0]?.subjectTitle, "Ship the release");
      assert.equal(notifications[0]?.isUnread, true);
      assert.equal(notifications[0]?.subjectHref.includes(itemId), true);
    }

    // Filtering by category narrows to that category's NotificationTypes.
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);

      const noteNotificationId = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "NOTE_ADDED",
      });
      await createNotification({ recipientId, actorId: creatorId, itemId, type: "STATE_CHANGED" });

      const noteOnly = await loadActivityNotifications(prisma, { recipientId, category: "notes" });
      assert.deepEqual(noteOnly.map((n) => n.id), [noteNotificationId]);
    }

    // markNotificationRead flips readAt only for the given recipient, is
    // idempotent, and countUnreadNotifications reflects the change —
    // including DUE_DATE_REMINDER, which counts toward the badge even
    // though it's excluded from the Activity list above.
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);
      const otherUserId = await createUser("Someone Else");

      const notificationId = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "ASSIGNEE_ADDED",
      });
      const reminderId = await createNotification({ recipientId, itemId, type: "DUE_DATE_REMINDER" });

      assert.equal(await countUnreadNotifications(prisma, recipientId), 2);

      // A different User can't mark someone else's notification read.
      await markNotificationRead(prisma, { notificationId, recipientId: otherUserId });
      assert.equal(await countUnreadNotifications(prisma, recipientId), 2);

      await markNotificationRead(prisma, { notificationId, recipientId });
      assert.equal(await countUnreadNotifications(prisma, recipientId), 1);

      // Idempotent: marking an already-read notification read again is a
      // no-op, not an error.
      await markNotificationRead(prisma, { notificationId, recipientId });
      assert.equal(await countUnreadNotifications(prisma, recipientId), 1);

      await markNotificationRead(prisma, { notificationId: reminderId, recipientId });
      assert.equal(await countUnreadNotifications(prisma, recipientId), 0);
    }

    // Bookmarks, Archive, and @Mentioned are thin filters over the same
    // notifications, each scoped to the recipient, against a fixture set
    // with varying read/bookmarked/archived/type state (#49).
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);
      const otherUserId = await createUser("Someone Else");

      const bookmarkedActive = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "ASSIGNEE_ADDED",
        bookmarkedAt: new Date(),
      });
      const bookmarkedAndArchived = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "NOTE_ADDED",
        bookmarkedAt: new Date(),
        archivedAt: new Date(),
      });
      const archivedOnly = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "STATE_CHANGED",
        archivedAt: new Date(),
      });
      const mentionActive = await createNotification({ recipientId, actorId: creatorId, itemId, type: "MENTIONED" });
      const mentionArchived = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "MENTIONED",
        archivedAt: new Date(),
      });
      await createNotification({ recipientId: otherUserId, actorId: creatorId, itemId, type: "MENTIONED" });

      const bookmarked = await loadBookmarkedNotifications(prisma, { recipientId });
      assert.deepEqual(
        bookmarked.map((n) => n.id).sort(),
        [bookmarkedActive],
        "Bookmarks excludes an archived-and-bookmarked notification — Archive owns that row now"
      );

      const archived = await loadArchivedNotifications(prisma, { recipientId });
      assert.deepEqual(
        archived.map((n) => n.id).sort(),
        [archivedOnly, bookmarkedAndArchived, mentionArchived].sort(),
        "Archive lists every archived notification regardless of type or bookmark state"
      );
      assert.equal(archived.find((n) => n.id === bookmarkedAndArchived)?.isBookmarked, true);

      const mentioned = await loadMentionedNotifications(prisma, { recipientId });
      assert.deepEqual(
        mentioned.map((n) => n.id).sort(),
        [mentionActive],
        "@Mentioned excludes archived Mentions and another recipient's Mentions"
      );
    }

    // toggleNotificationBookmark flips bookmarkedAt for the owning
    // recipient only, and is a true toggle (bookmark, then unbookmark).
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);
      const otherUserId = await createUser("Someone Else");
      const notificationId = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "ASSIGNEE_ADDED",
      });

      const otherAttempt = await toggleNotificationBookmark(prisma, { notificationId, recipientId: otherUserId });
      assert.deepEqual(otherAttempt, { status: "not-found" });
      assert.equal((await loadBookmarkedNotifications(prisma, { recipientId })).length, 0);

      const bookmarked = await toggleNotificationBookmark(prisma, { notificationId, recipientId });
      assert.deepEqual(bookmarked, { status: "bookmarked" });
      assert.deepEqual((await loadBookmarkedNotifications(prisma, { recipientId })).map((n) => n.id), [
        notificationId,
      ]);

      const unbookmarked = await toggleNotificationBookmark(prisma, { notificationId, recipientId });
      assert.deepEqual(unbookmarked, { status: "unbookmarked" });
      assert.equal((await loadBookmarkedNotifications(prisma, { recipientId })).length, 0);
    }

    // archiveNotification sets archivedAt for the owning recipient only,
    // never deletes the row, and is idempotent when already archived.
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);
      const otherUserId = await createUser("Someone Else");
      const notificationId = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "ASSIGNEE_ADDED",
      });

      await archiveNotification(prisma, { notificationId, recipientId: otherUserId });
      assert.equal((await loadArchivedNotifications(prisma, { recipientId })).length, 0);

      await archiveNotification(prisma, { notificationId, recipientId });
      assert.deepEqual((await loadArchivedNotifications(prisma, { recipientId })).map((n) => n.id), [
        notificationId,
      ]);
      assert.equal((await prisma.notification.count({ where: { id: notificationId } })), 1, "archiving never deletes the row");

      await archiveNotification(prisma, { notificationId, recipientId });
      assert.deepEqual((await loadArchivedNotifications(prisma, { recipientId })).map((n) => n.id), [
        notificationId,
      ]);
    }

    // A membership-change notification (#89) carries no Item, only a
    // Workspace — it still shows up in Activity (both "All" and its own
    // "membership" category) and counts toward the unread badge, same as
    // an Item-based notification. The role-changed notice's subject title
    // shows the snapshotted newRole, and the two types route open to
    // different places since a removed recipient has nowhere left to go
    // inside the Workspace.
    {
      const workspaceId = randomUUID();
      createdWorkspaceIds.push(workspaceId);
      await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team" } });
      const recipientId = await createUser("Recipient");
      const actorId = await createUser("Priya");

      const removedId = randomUUID();
      await prisma.notification.create({
        data: { id: removedId, recipientId, actorId, workspaceId, type: "WORKSPACE_MEMBER_REMOVED" },
      });
      const roleChangedId = randomUUID();
      await prisma.notification.create({
        data: {
          id: roleChangedId,
          recipientId,
          actorId,
          workspaceId,
          type: "WORKSPACE_ROLE_CHANGED",
          newRole: "ADMIN",
        },
      });

      const activity = await loadActivityNotifications(prisma, { recipientId });
      const removed = activity.find((n) => n.id === removedId);
      assert.ok(removed, "WORKSPACE_MEMBER_REMOVED appears in the Activity tab");
      assert.equal(removed?.subjectTitle, "Launch Team");
      assert.equal(removed?.subjectHref, "/");

      const roleChanged = activity.find((n) => n.id === roleChangedId);
      assert.ok(roleChanged, "WORKSPACE_ROLE_CHANGED appears in the Activity tab");
      assert.equal(roleChanged?.subjectTitle, "Admin in Launch Team");
      assert.equal(roleChanged?.subjectHref, `/workspaces/${workspaceId}`);

      const membershipOnly = await loadActivityNotifications(prisma, { recipientId, category: "membership" });
      assert.deepEqual(membershipOnly.map((n) => n.id).sort(), [removedId, roleChangedId].sort());

      assert.equal(await countUnreadNotifications(prisma, recipientId), 2);
    }

    // A Notification whose Item lives in a Deleted Workspace drops out of
    // every tab and the unread badge count, while a sibling notification
    // from a live Workspace still shows (#76).
    {
      const live = await createWorkspaceWithItem();
      const deleted = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(live.workspaceId, live.listId, recipientId);
      await grantListAccess(deleted.workspaceId, deleted.listId, recipientId);

      const liveNotificationId = await createNotification({
        recipientId,
        actorId: live.creatorId,
        itemId: live.itemId,
        type: "ASSIGNEE_ADDED",
      });
      await createNotification({
        recipientId,
        actorId: deleted.creatorId,
        itemId: deleted.itemId,
        type: "ASSIGNEE_ADDED",
        bookmarkedAt: new Date(),
      });
      await createNotification({
        recipientId,
        actorId: deleted.creatorId,
        itemId: deleted.itemId,
        type: "MENTIONED",
      });
      await createNotification({
        recipientId,
        actorId: deleted.creatorId,
        itemId: deleted.itemId,
        type: "STATE_CHANGED",
        archivedAt: new Date(),
      });

      const deletedItem = await prisma.item.findUniqueOrThrow({ where: { id: deleted.itemId } });
      const deletedList = await prisma.list.findUniqueOrThrow({ where: { id: deletedItem.listId } });

      // A membership notice anchored directly to the Deleted Workspace
      // (no Item to join through) must drop out the same way (#89).
      await prisma.notification.create({
        data: {
          id: randomUUID(),
          recipientId,
          actorId: deleted.creatorId,
          workspaceId: deletedList.workspaceId,
          type: "WORKSPACE_MEMBER_REMOVED",
        },
      });

      await prisma.workspace.update({ where: { id: deletedList.workspaceId }, data: { deletedAt: new Date() } });

      assert.deepEqual(
        (await loadActivityNotifications(prisma, { recipientId })).map((n) => n.id),
        [liveNotificationId]
      );
      assert.deepEqual(
        (await loadBookmarkedNotifications(prisma, { recipientId })).map((n) => n.id),
        [],
        "the Deleted Workspace's bookmarked notification must not surface"
      );
      assert.deepEqual((await loadMentionedNotifications(prisma, { recipientId })).map((n) => n.id), []);
      assert.deepEqual(
        (await loadArchivedNotifications(prisma, { recipientId })).map((n) => n.id),
        [],
        "even an archived notification from a Deleted Workspace stays excluded"
      );
      assert.equal(await countUnreadNotifications(prisma, recipientId), 1, "only the live Workspace's notification counts");
    }

    // #107/ADR 0021: a Notification about an Item the recipient has since
    // lost List access to is excluded from every loader and from the
    // unread count, without the row itself being deleted, and reappears
    // once access is restored — without the Notification being recreated.
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const recipientId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, recipientId);

      const notificationId = await createNotification({
        recipientId,
        actorId: creatorId,
        itemId,
        type: "ASSIGNEE_ADDED",
        bookmarkedAt: new Date(),
      });
      const mentionId = await createNotification({ recipientId, actorId: creatorId, itemId, type: "MENTIONED" });

      assert.deepEqual((await loadActivityNotifications(prisma, { recipientId })).map((n) => n.id).sort(), [
        mentionId,
        notificationId,
      ].sort());
      assert.deepEqual((await loadBookmarkedNotifications(prisma, { recipientId })).map((n) => n.id), [
        notificationId,
      ]);
      assert.deepEqual((await loadMentionedNotifications(prisma, { recipientId })).map((n) => n.id), [mentionId]);
      assert.equal(await countUnreadNotifications(prisma, recipientId), 2);

      await prisma.listMember.deleteMany({ where: { listId, userId: recipientId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: recipientId } });

      assert.deepEqual(await loadActivityNotifications(prisma, { recipientId }), []);
      assert.deepEqual(await loadBookmarkedNotifications(prisma, { recipientId }), []);
      assert.deepEqual(await loadMentionedNotifications(prisma, { recipientId }), []);
      assert.equal(await countUnreadNotifications(prisma, recipientId), 0);
      assert.equal(
        await prisma.notification.count({ where: { id: { in: [notificationId, mentionId] } } }),
        2,
        "losing access must never delete the underlying Notification rows"
      );

      await grantListAccess(workspaceId, listId, recipientId);

      assert.deepEqual((await loadActivityNotifications(prisma, { recipientId })).map((n) => n.id).sort(), [
        mentionId,
        notificationId,
      ].sort());
      assert.equal(await countUnreadNotifications(prisma, recipientId), 2);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.notification.deleteMany({
      where: { OR: [{ item: { listId: { in: listIds } } }, { workspaceId: { in: createdWorkspaceIds } }] },
    });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("notification inbox integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
