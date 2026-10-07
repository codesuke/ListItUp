import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { moveMyTaskItemToColumn } from "./item-my-tasks-board";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item my-tasks board integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `my-tasks-board-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithListAndMember(): Promise<{ listId: string; userId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    const userId = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "MEMBER" } });
    return { listId, userId };
  }

  async function createTestItem(listId: string, creatorId: string): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title: "Test Item", creatorId } });
    return itemId;
  }

  try {
    // A Member can drag a card between STATE/PRIORITY columns.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);

      const moved = await moveMyTaskItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "PRIORITY",
        columnKey: "HIGH",
      });
      assert.deepEqual(moved, { status: "moved" });
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.priority, "HIGH");
    }

    // #104 story 10: dragging a card on My Tasks' Board is refused with
    // list-archived once the Item's List is archived, for STATE and
    // PRIORITY alike.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      assert.deepEqual(
        await moveMyTaskItemToColumn(prisma, { actorUserId: userId, itemId, groupBy: "STATE", columnKey: "COMPLETE" }),
        { status: "list-archived" }
      );
      assert.deepEqual(
        await moveMyTaskItemToColumn(prisma, { actorUserId: userId, itemId, groupBy: "PRIORITY", columnKey: "HIGH" }),
        { status: "list-archived" }
      );

      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "TO_DO");
      assert.equal(item.priority, "NORMAL");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
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

  console.log("item my-tasks board integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
