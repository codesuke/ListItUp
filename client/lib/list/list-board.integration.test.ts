import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { moveItemToColumn, setBoardGroupBy, UNASSIGNED_COLUMN_KEY, UNSECTIONED_COLUMN_KEY } from "./list-board";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list board integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `list-board-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithListAndMember(
    listRole: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<{ workspaceId: string; listId: string; userId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    const userId = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: listRole } });
    return { workspaceId, listId, userId };
  }

  async function createTestItem(listId: string, creatorId: string): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title: "Test Item", creatorId } });
    return itemId;
  }

  try {
    // Moving into the BLOCKED state column without a reason is rejected;
    // with a reason it succeeds and persists the state (#5's rule).
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);

      const rejected = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "STATE",
        columnKey: "BLOCKED",
      });
      assert.deepEqual(rejected, { status: "blocker-reason-required" });

      const moved = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "STATE",
        columnKey: "BLOCKED",
        blockerReason: "Waiting on vendor",
      });
      assert.deepEqual(moved, { status: "moved" });
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "BLOCKED");
      assert.equal(item.blockerReason, "Waiting on vendor");
    }

    // A List Viewer cannot move an Item on the Board.
    {
      const { listId, userId: viewerId } = await createWorkspaceWithListAndMember("VIEWER");
      const creatorId = await createUser();
      const itemId = await createTestItem(listId, creatorId);

      const result = await moveItemToColumn(prisma, {
        actorUserId: viewerId,
        itemId,
        groupBy: "STATE",
        columnKey: "COMPLETE",
      });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // Grouped by Section, moving updates sectionId; moving to the
    // unsectioned column clears it.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const sectionId = randomUUID();
      await prisma.section.create({ data: { id: sectionId, listId, name: "Design", order: 0 } });
      const itemId = await createTestItem(listId, userId);

      const moved = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "SECTION",
        columnKey: sectionId,
      });
      assert.deepEqual(moved, { status: "moved" });
      let item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.sectionId, sectionId);

      const clearedMove = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "SECTION",
        columnKey: UNSECTIONED_COLUMN_KEY,
      });
      assert.deepEqual(clearedMove, { status: "moved" });
      item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.sectionId, null);
    }

    // Grouped by Assignee, moving into a Member's column adds them as an
    // Assignee; moving into "Unassigned" is rejected as ambiguous for a
    // multi-valued field.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const assigneeId = await createUser();
      const itemId = await createTestItem(listId, userId);

      const moved = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "ASSIGNEE",
        columnKey: assigneeId,
      });
      assert.deepEqual(moved, { status: "moved" });
      const assignees = await prisma.itemAssignee.findMany({ where: { itemId } });
      assert.deepEqual(assignees.map((a) => a.userId), [assigneeId]);

      const invalid = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId,
        groupBy: "ASSIGNEE",
        columnKey: UNASSIGNED_COLUMN_KEY,
      });
      assert.deepEqual(invalid, { status: "invalid-column" });
    }

    // A non-existent Item is reported rather than throwing.
    {
      const { userId } = await createWorkspaceWithListAndMember();
      const result = await moveItemToColumn(prisma, {
        actorUserId: userId,
        itemId: randomUUID(),
        groupBy: "STATE",
        columnKey: "COMPLETE",
      });
      assert.deepEqual(result, { status: "item-not-found" });
    }

    // A List Member can change the Board's grouping; a List Viewer cannot.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const result = await setBoardGroupBy(prisma, { actorUserId: userId, listId, groupBy: "SECTION" });
      assert.deepEqual(result, { status: "updated" });

      const invalid = await setBoardGroupBy(prisma, { actorUserId: userId, listId, groupBy: "PRIORITY" });
      assert.deepEqual(invalid, { status: "invalid-group-by" });

      const { userId: viewerId } = await createWorkspaceWithListAndMember("VIEWER");
      const forbidden = await setBoardGroupBy(prisma, { actorUserId: viewerId, listId, groupBy: "STATE" });
      assert.deepEqual(forbidden, { status: "forbidden" });
    }

    // #104 story 10: dragging an Item on the Board is refused with
    // list-archived once the List is archived — STATE, SECTION, and
    // ASSIGNEE columns alike, since all three dispatch through the same
    // guarded lib/item/ mutations.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      assert.deepEqual(
        await moveItemToColumn(prisma, { actorUserId: userId, itemId, groupBy: "STATE", columnKey: "COMPLETE" }),
        { status: "list-archived" }
      );
      assert.deepEqual(
        await moveItemToColumn(prisma, {
          actorUserId: userId,
          itemId,
          groupBy: "SECTION",
          columnKey: UNSECTIONED_COLUMN_KEY,
        }),
        { status: "list-archived" }
      );
      assert.deepEqual(
        await moveItemToColumn(prisma, { actorUserId: userId, itemId, groupBy: "ASSIGNEE", columnKey: userId }),
        { status: "list-archived" }
      );

      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "TO_DO", "Item must be untouched");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.section.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list board integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
