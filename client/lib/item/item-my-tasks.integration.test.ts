import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { transitionItemState } from "./item-lifecycle";
import { loadMyTasksItems } from "./item-my-tasks";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item my-tasks integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `my-tasks-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithList(
    name: string,
    kind: "SHARED" | "PERSONAL" = "SHARED"
  ): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: `${name} List` } });
    return { workspaceId, listId };
  }

  async function addMember(
    workspaceId: string,
    listId: string,
    userId: string,
    role: "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
  }

  async function createItem(
    listId: string,
    creatorId: string,
    overrides: Partial<{
      title: string;
      state: "TO_DO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" | "ARCHIVED";
      priority: "LOW" | "NORMAL" | "HIGH";
      dueDate: Date | null;
    }> = {}
  ): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({
      data: {
        id: itemId,
        listId,
        creatorId,
        title: overrides.title ?? "Test Item",
        state: overrides.state ?? "TO_DO",
        priority: overrides.priority ?? "NORMAL",
        dueDate: overrides.dueDate ?? null,
      },
    });
    return itemId;
  }

  async function assign(itemId: string, userId: string): Promise<void> {
    await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId } });
  }

  try {
    // A fixture spanning two shared Workspaces plus the User's Personal
    // Space asserts correct source-Workspace tagging and cross-Workspace
    // unification (#42).
    {
      const userId = await createUser();

      const workspaceA = await createWorkspaceWithList("Marketing");
      await addMember(workspaceA.workspaceId, workspaceA.listId, userId);
      const itemA = await createItem(workspaceA.listId, userId, { title: "Ship the campaign" });
      await assign(itemA, userId);

      const workspaceB = await createWorkspaceWithList("Engineering");
      await addMember(workspaceB.workspaceId, workspaceB.listId, userId);
      const itemB = await createItem(workspaceB.listId, userId, { title: "Fix the build" });
      await assign(itemB, userId);

      const personalSpace = await createWorkspaceWithList("Personal Space", "PERSONAL");
      await addMember(personalSpace.workspaceId, personalSpace.listId, userId);
      const itemPersonal = await createItem(personalSpace.listId, userId, { title: "Buy groceries" });
      await assign(itemPersonal, userId);

      const items = await loadMyTasksItems(prisma, { userId });

      assert.equal(items.length, 3, "expected Items unified across every source");
      const byTitle = new Map(items.map((item) => [item.title, item]));

      assert.equal(byTitle.get("Ship the campaign")?.sourceWorkspaceId, workspaceA.workspaceId);
      assert.equal(byTitle.get("Ship the campaign")?.sourceWorkspaceName, "Marketing");
      assert.equal(byTitle.get("Ship the campaign")?.sourceWorkspaceKind, "SHARED");

      assert.equal(byTitle.get("Fix the build")?.sourceWorkspaceId, workspaceB.workspaceId);
      assert.equal(byTitle.get("Fix the build")?.sourceWorkspaceName, "Engineering");

      assert.equal(byTitle.get("Buy groceries")?.sourceWorkspaceId, personalSpace.workspaceId);
      assert.equal(byTitle.get("Buy groceries")?.sourceWorkspaceKind, "PERSONAL");

      // Filterable by source Workspace.
      const filtered = await loadMyTasksItems(prisma, { userId, sourceWorkspaceId: workspaceA.workspaceId });
      assert.deepEqual(filtered.map((item) => item.title), ["Ship the campaign"]);
    }

    // Default visibility excludes COMPLETE/ARCHIVED unless an explicit
    // filter is applied; the exact default sort order is checked in
    // item-my-tasks.test.ts's pure unit test.
    {
      const userId = await createUser();
      const { workspaceId, listId } = await createWorkspaceWithList("Ops");
      await addMember(workspaceId, listId, userId);

      const todoId = await createItem(listId, userId, { title: "Open task", state: "TO_DO" });
      const inProgressId = await createItem(listId, userId, { title: "Active task", state: "IN_PROGRESS" });
      const completeId = await createItem(listId, userId, { title: "Done task", state: "COMPLETE" });
      const archivedId = await createItem(listId, userId, { title: "Old task", state: "ARCHIVED" });
      for (const itemId of [todoId, inProgressId, completeId, archivedId]) {
        await assign(itemId, userId);
      }

      const defaultView = await loadMyTasksItems(prisma, { userId });
      assert.deepEqual(
        new Set(defaultView.map((item) => item.title)),
        new Set(["Open task", "Active task"]),
        "COMPLETE/ARCHIVED must be hidden by default"
      );

      const withCompleted = await loadMyTasksItems(prisma, { userId, includeCompleted: true });
      assert.ok(withCompleted.some((item) => item.title === "Done task"));

      const withArchived = await loadMyTasksItems(prisma, { userId, includeArchived: true });
      assert.ok(withArchived.some((item) => item.title === "Old task"));
    }

    // Search filters the unified set by title, case-insensitively, without
    // touching visibility/sort defaults (#44).
    {
      const userId = await createUser();
      const { workspaceId, listId } = await createWorkspaceWithList("Ops");
      await addMember(workspaceId, listId, userId);

      const matchId = await createItem(listId, userId, { title: "Fix the platform signage" });
      const otherId = await createItem(listId, userId, { title: "Draft onboarding checklist" });
      await assign(matchId, userId);
      await assign(otherId, userId);

      const results = await loadMyTasksItems(prisma, { userId, search: "SIGNAGE" });
      assert.deepEqual(results.map((item) => item.title), ["Fix the platform signage"]);
    }

    // sortBy overrides the default order (#44); PRIORITY here since it's
    // observably different from SMART for this fixture.
    {
      const userId = await createUser();
      const { workspaceId, listId } = await createWorkspaceWithList("Ops");
      await addMember(workspaceId, listId, userId);

      const lowId = await createItem(listId, userId, { title: "Low priority", priority: "LOW", dueDate: new Date("2026-09-01T00:00:00.000Z") });
      const highId = await createItem(listId, userId, { title: "High priority", priority: "HIGH", dueDate: new Date("2026-09-30T00:00:00.000Z") });
      await assign(lowId, userId);
      await assign(highId, userId);

      const byPriority = await loadMyTasksItems(prisma, { userId, sortBy: "PRIORITY" });
      assert.deepEqual(byPriority.map((item) => item.title), ["High priority", "Low priority"]);
    }

    // Completing an Item from My Tasks calls the same lib/item mutation as
    // elsewhere: complete via the My Tasks path, then read the Item through
    // its source List and assert identical state — not a copy (#42).
    {
      const userId = await createUser();
      const { workspaceId, listId } = await createWorkspaceWithList("Design");
      await addMember(workspaceId, listId, userId);
      const itemId = await createItem(listId, userId, { title: "Review mocks" });
      await assign(itemId, userId);

      const [myTaskItem] = await loadMyTasksItems(prisma, { userId });
      assert.equal(myTaskItem.id, itemId);

      const result = await transitionItemState(prisma, {
        actorUserId: userId,
        itemId: myTaskItem.id,
        state: "COMPLETE",
      });
      assert.deepEqual(result, { status: "transitioned" });

      const viaSourceList = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(viaSourceList.state, "COMPLETE", "the same Item row must reflect the completion");

      const stillInMyTasks = await loadMyTasksItems(prisma, { userId });
      assert.equal(stillInMyTasks.length, 0, "a COMPLETE Item drops out of the default My Tasks view");
    }

    // An Item assigned in a Deleted Workspace never surfaces in My Tasks,
    // across every other source Workspace's Items still showing (#76).
    {
      const userId = await createUser();

      const live = await createWorkspaceWithList("Live");
      await addMember(live.workspaceId, live.listId, userId);
      const liveItemId = await createItem(live.listId, userId, { title: "Still visible" });
      await assign(liveItemId, userId);

      const deleted = await createWorkspaceWithList("Retired");
      await addMember(deleted.workspaceId, deleted.listId, userId);
      const deletedItemId = await createItem(deleted.listId, userId, { title: "Should vanish" });
      await assign(deletedItemId, userId);
      await prisma.workspace.update({
        where: { id: deleted.workspaceId },
        data: { deletedAt: new Date() },
      });

      const items = await loadMyTasksItems(prisma, { userId });
      assert.deepEqual(items.map((item) => item.title), ["Still visible"]);
    }

    // #104: an Item's listArchivedAt reflects its source List's own
    // archived status — the Board view's per-card "Archived" indicator and
    // disabled drag read off this, since My Tasks spans many Lists at once.
    {
      const userId = await createUser();

      const active = await createWorkspaceWithList("Active");
      await addMember(active.workspaceId, active.listId, userId);
      const activeItemId = await createItem(active.listId, userId, { title: "In an active List" });
      await assign(activeItemId, userId);

      const archived = await createWorkspaceWithList("Archived Project");
      await addMember(archived.workspaceId, archived.listId, userId);
      const archivedItemId = await createItem(archived.listId, userId, { title: "In an archived List" });
      await assign(archivedItemId, userId);
      await prisma.list.update({ where: { id: archived.listId }, data: { archivedAt: new Date() } });

      const items = await loadMyTasksItems(prisma, { userId });
      const byTitle = new Map(items.map((item) => [item.title, item]));
      assert.equal(byTitle.get("In an active List")?.listArchivedAt, null);
      assert.ok(byTitle.get("In an archived List")?.listArchivedAt);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("item my-tasks integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
