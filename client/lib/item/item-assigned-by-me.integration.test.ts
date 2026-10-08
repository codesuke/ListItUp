import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadAssignedByMeItems } from "./item-assigned-by-me";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item assigned-by-me integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `assigned-by-me-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithList(name: string): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind: "SHARED" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: `${name} List` } });
    return { workspaceId, listId };
  }

  async function createItem(listId: string, creatorId: string, title: string): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, creatorId, title } });
    return itemId;
  }

  async function assign(itemId: string, userId: string): Promise<void> {
    await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId } });
  }

  try {
    // Creator-based approximation (#46, QnA §13): an Item the current User
    // created and delegated to someone else counts; an Item the User
    // created and kept for themself, or delegated by someone else, does
    // not, and cross-Workspace Items never leak in.
    const owner = await createUser();
    const delegate = await createUser();
    const { workspaceId, listId } = await createWorkspaceWithList("Marketing");
    const otherWorkspace = await createWorkspaceWithList("Engineering");
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: owner, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: owner, role: "MEMBER" } });

    const delegatedItem = await createItem(listId, owner, "Delegated brief");
    await assign(delegatedItem, delegate);

    const selfAssignedItem = await createItem(listId, owner, "Kept for myself");
    await assign(selfAssignedItem, owner);

    const othersItem = await createItem(listId, delegate, "Someone else's Item");
    await assign(othersItem, owner);

    const crossWorkspaceItem = await createItem(otherWorkspace.listId, owner, "Wrong Workspace");
    await assign(crossWorkspaceItem, delegate);

    const items = await loadAssignedByMeItems(prisma, { userId: owner, workspaceId });

    assert.deepEqual(items.map((item) => item.title), ["Delegated brief"]);
    assert.equal(items[0].assigneeCount, 1);

    // #107 story 9: an archived List's delegated Item is excluded, even
    // though the creator still has normal role-based access to that List.
    {
      const archivedListWorkspace = await createWorkspaceWithList("Archived");
      const archivedItem = await createItem(archivedListWorkspace.listId, owner, "In an archived List");
      await assign(archivedItem, delegate);
      await prisma.list.update({ where: { id: archivedListWorkspace.listId }, data: { archivedAt: new Date() } });

      const results = await loadAssignedByMeItems(prisma, {
        userId: owner,
        workspaceId: archivedListWorkspace.workspaceId,
      });
      assert.deepEqual(results, []);
    }

    // #107/ADR 0021: a Deleted Workspace's delegated Items never surface —
    // a pre-existing gap this surface didn't close before (My Tasks
    // already did).
    {
      const deletedWorkspace = await createWorkspaceWithList("Retired");
      const deletedItem = await createItem(deletedWorkspace.listId, owner, "In a deleted Workspace");
      await assign(deletedItem, delegate);
      await prisma.workspace.update({ where: { id: deletedWorkspace.workspaceId }, data: { deletedAt: new Date() } });

      const results = await loadAssignedByMeItems(prisma, { userId: owner, workspaceId: deletedWorkspace.workspaceId });
      assert.deepEqual(results, []);
    }

    // #107/ADR 0021: the creator (the viewer here) losing List access hides
    // their own delegated Item until access is restored, without needing
    // to recreate the delegation.
    {
      const { workspaceId: accessWorkspaceId, listId: accessListId } = await createWorkspaceWithList("Design");
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId: accessWorkspaceId, userId: owner, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId: accessListId, userId: owner, role: "MEMBER" },
      });
      const revocableItem = await createItem(accessListId, owner, "Loses access to its own List");
      await assign(revocableItem, delegate);

      assert.deepEqual(
        (await loadAssignedByMeItems(prisma, { userId: owner, workspaceId: accessWorkspaceId })).map(
          (item) => item.title
        ),
        ["Loses access to its own List"]
      );

      await prisma.listMember.deleteMany({ where: { listId: accessListId, userId: owner } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: accessWorkspaceId, userId: owner } });

      assert.deepEqual(await loadAssignedByMeItems(prisma, { userId: owner, workspaceId: accessWorkspaceId }), []);

      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId: accessWorkspaceId, userId: owner, role: "MEMBER" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId: accessListId, userId: owner, role: "MEMBER" },
      });

      assert.deepEqual(
        (await loadAssignedByMeItems(prisma, { userId: owner, workspaceId: accessWorkspaceId })).map(
          (item) => item.title
        ),
        ["Loses access to its own List"]
      );
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("item assigned-by-me integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
