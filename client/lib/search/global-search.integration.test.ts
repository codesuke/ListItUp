import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { globalSearch } from "./global-search";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("global search integration test skipped: DATABASE_URL is not set");
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
    await prisma.user.create({
      data: { id: userId, name, email: `global-search-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    return workspaceId;
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  async function createList(
    workspaceId: string,
    overrides: Partial<{ name: string; archivedAt: Date }> = {}
  ): Promise<string> {
    const listId = randomUUID();
    await prisma.list.create({
      data: { id: listId, workspaceId, name: overrides.name ?? "Test List", archivedAt: overrides.archivedAt },
    });
    return listId;
  }

  async function addListMember(listId: string, userId: string) {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "MEMBER" } });
  }

  async function createItem(
    listId: string,
    creatorId: string,
    overrides: Partial<{ title: string; state: "TO_DO" | "ARCHIVED" }> = {}
  ): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({
      data: { id: itemId, listId, creatorId, title: overrides.title ?? "Test Item", state: overrides.state },
    });
    return itemId;
  }

  async function cleanupWorkspaces() {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  try {
    // A Workspace Owner's results include Lists/Items they have no
    // explicit ListMember row on, matching browseLists' visibility rule.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const listId = await createList(workspaceId, { name: "Platform Retrofit" });
      const itemId = await createItem(listId, ownerId, { title: "Retrofit the auth module" });

      const results = await globalSearch(prisma, { userId: ownerId, workspaceId, query: "retrofit" });
      assert.deepEqual(results.lists.map((l) => l.id), [listId]);
      assert.deepEqual(results.items.map((i) => i.id), [itemId]);
    }

    // A Workspace Member only sees Lists/Items from Lists they're an
    // explicit ListMember of.
    {
      const workspaceId = await createWorkspace();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      const visibleList = await createList(workspaceId, { name: "Vendor Onboarding" });
      await addListMember(visibleList, memberId);
      await createItem(visibleList, memberId, { title: "Onboarding checklist" });
      const hiddenList = await createList(workspaceId, { name: "Onboarding Secrets" });
      await createItem(hiddenList, memberId, { title: "Onboarding credentials" });

      const results = await globalSearch(prisma, { userId: memberId, workspaceId, query: "onboarding" });
      assert.deepEqual(results.lists.map((l) => l.id), [visibleList]);
      assert.equal(results.items.length, 1);
      assert.equal(results.items[0].listId, visibleList);
    }

    // Archived Lists, and Items in state ARCHIVED, are excluded.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      await createList(workspaceId, { name: "Shelved Launch", archivedAt: new Date() });
      const activeList = await createList(workspaceId, { name: "Shelved Resources" });
      await createItem(activeList, ownerId, { title: "Shelved item", state: "ARCHIVED" });

      const results = await globalSearch(prisma, { userId: ownerId, workspaceId, query: "shelved" });
      assert.deepEqual(results.lists.map((l) => l.id), [activeList]);
      assert.deepEqual(results.items, []);
    }

    // Member results are drawn from the current Workspace's roster,
    // matched by name, ordered alphabetically.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser("Olivia Owner");
      const zed = await createUser("Zed Harrington");
      const amara = await createUser("Amara Harrington");
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      await addWorkspaceMember(workspaceId, zed, "MEMBER");
      await addWorkspaceMember(workspaceId, amara, "MEMBER");

      const otherWorkspaceId = await createWorkspace();
      const strangerHarrington = await createUser("Strange Harrington");
      await addWorkspaceMember(otherWorkspaceId, strangerHarrington, "MEMBER");

      const results = await globalSearch(prisma, { userId: ownerId, workspaceId, query: "harrington" });
      assert.deepEqual(
        results.members.map((m) => m.userId),
        [amara, zed]
      );
    }

    // Results are capped at 5 per category.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      for (let i = 0; i < 6; i += 1) {
        await createList(workspaceId, { name: `Capped List ${i}` });
      }

      const results = await globalSearch(prisma, { userId: ownerId, workspaceId, query: "capped" });
      assert.equal(results.lists.length, 5);
    }

    // A non-member of the Workspace gets no results.
    {
      const workspaceId = await createWorkspace();
      const strangerId = await createUser();
      await createList(workspaceId, { name: "Private List" });

      const results = await globalSearch(prisma, { userId: strangerId, workspaceId, query: "private" });
      assert.deepEqual(results, { lists: [], items: [], members: [] });
    }

    // A blank query returns no results rather than the whole Workspace.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      await createList(workspaceId, { name: "Anything" });

      const results = await globalSearch(prisma, { userId: ownerId, workspaceId, query: "   " });
      assert.deepEqual(results, { lists: [], items: [], members: [] });
    }
  } finally {
    await cleanupWorkspaces();
    await prisma.$disconnect();
  }

  console.log("global search integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
