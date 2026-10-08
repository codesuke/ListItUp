import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { archiveNotification, markNotificationRead, toggleNotificationBookmark } from "@/lib/notification/notification-inbox";

import { loadUpdatesPageData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("Updates page smoke test skipped: DATABASE_URL is not set");
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
    await prisma.user.create({ data: { id: userId, name, email: `updates-page-${userId}@example.test` } });
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

  // The read-time access re-check (#107/ADR 0021) means a recipient needs
  // an explicit grant to see an Item-anchored notification at all.
  async function grantListAccess(workspaceId: string, listId: string, userId: string): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "MEMBER" } });
  }

  try {
    // Activity returns only the signed-in User's own notifications, sorted
    // newest first, and opening one (markNotificationRead) flips its read
    // state and updates the unread badge count returned alongside it (#47).
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const userId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, userId);
      const otherUserId = await createUser("Someone Else");

      const olderId = randomUUID();
      await prisma.notification.create({
        data: { id: olderId, recipientId: userId, actorId: creatorId, itemId, type: "ASSIGNEE_ADDED" },
      });
      await prisma.notification.update({ where: { id: olderId }, data: { createdAt: new Date(Date.now() - 60_000) } });
      const newerId = randomUUID();
      await prisma.notification.create({
        data: { id: newerId, recipientId: userId, actorId: creatorId, itemId, type: "NOTE_ADDED" },
      });
      await prisma.notification.create({
        data: { id: randomUUID(), recipientId: otherUserId, actorId: creatorId, itemId, type: "ASSIGNEE_ADDED" },
      });

      const before = await loadUpdatesPageData(prisma, { userId, tab: "activity" });
      assert.deepEqual(before.notifications.map((n) => n.id), [newerId, olderId]);
      assert.equal(before.unreadCount, 2);
      assert.equal(before.notifications[0]?.isUnread, true);

      await markNotificationRead(prisma, { notificationId: newerId, recipientId: userId });

      const after = await loadUpdatesPageData(prisma, { userId, tab: "activity" });
      assert.equal(after.unreadCount, 1);
      const reopenedNewer = after.notifications.find((n) => n.id === newerId);
      assert.equal(reopenedNewer?.isUnread, false);
      const stillUnreadOlder = after.notifications.find((n) => n.id === olderId);
      assert.equal(stillUnreadOlder?.isUnread, true);
    }

    // Bookmarks, Archive, and @Mentioned tabs each return the correctly
    // filtered slice of the same fixture set, scoped to the signed-in User
    // (#49's per-tab smoke coverage).
    {
      const { itemId, creatorId, listId, workspaceId } = await createWorkspaceWithItem();
      const userId = await createUser("Recipient");
      await grantListAccess(workspaceId, listId, userId);

      const toBookmark = randomUUID();
      await prisma.notification.create({
        data: { id: toBookmark, recipientId: userId, actorId: creatorId, itemId, type: "ASSIGNEE_ADDED" },
      });
      const toArchive = randomUUID();
      await prisma.notification.create({
        data: { id: toArchive, recipientId: userId, actorId: creatorId, itemId, type: "STATE_CHANGED" },
      });
      const mentionId = randomUUID();
      await prisma.notification.create({
        data: { id: mentionId, recipientId: userId, actorId: creatorId, itemId, type: "MENTIONED" },
      });

      await toggleNotificationBookmark(prisma, { notificationId: toBookmark, recipientId: userId });
      await archiveNotification(prisma, { notificationId: toArchive, recipientId: userId });

      const bookmarksTab = await loadUpdatesPageData(prisma, { userId, tab: "bookmarks" });
      assert.deepEqual(bookmarksTab.notifications.map((n) => n.id), [toBookmark]);

      const archiveTab = await loadUpdatesPageData(prisma, { userId, tab: "archive" });
      assert.deepEqual(archiveTab.notifications.map((n) => n.id), [toArchive]);

      const mentionedTab = await loadUpdatesPageData(prisma, { userId, tab: "mentioned" });
      assert.deepEqual(mentionedTab.notifications.map((n) => n.id), [mentionId]);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.notification.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("Updates page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
