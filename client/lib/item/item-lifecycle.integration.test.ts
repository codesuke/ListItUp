import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { archiveItem, restoreItem, transitionItemState, updateItem } from "./item-lifecycle";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item lifecycle integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-lifecycle-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithListAndMember(
    role: "MEMBER" | "VIEWER" = "MEMBER",
    listRole: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<{ workspaceId: string; listId: string; userId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    const userId = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: listRole } });
    return { workspaceId, listId, userId };
  }

  async function createTestItem(listId: string, creatorId: string): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title: "Test Item", creatorId } });
    return itemId;
  }

  try {
    // A List Member can update title/Priority/due date.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);

      const result = await updateItem(prisma, {
        actorUserId: userId,
        itemId,
        title: "Renamed",
        priority: "HIGH",
        dueDate: new Date("2026-11-01T00:00:00.000Z"),
      });

      assert.deepEqual(result, { status: "updated" });
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.title, "Renamed");
      assert.equal(item.priority, "HIGH");
    }

    // A List Viewer cannot update an Item.
    {
      const { listId, userId: viewerId } = await createWorkspaceWithListAndMember("MEMBER", "VIEWER");
      const creatorId = await createUser();
      const itemId = await createTestItem(listId, creatorId);

      const result = await updateItem(prisma, { actorUserId: viewerId, itemId, title: "Nope" });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // Transitioning into BLOCKED without a reason is rejected; with a
    // reason it succeeds and persists the reason.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);

      const rejected = await transitionItemState(prisma, { actorUserId: userId, itemId, state: "BLOCKED" });
      assert.deepEqual(rejected, { status: "blocker-reason-required" });
      let item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "TO_DO");

      const accepted = await transitionItemState(prisma, {
        actorUserId: userId,
        itemId,
        state: "BLOCKED",
        blockerReason: "Waiting on vendor",
      });
      assert.deepEqual(accepted, { status: "transitioned" });
      item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "BLOCKED");
      assert.equal(item.blockerReason, "Waiting on vendor");
    }

    // Transitioning out of BLOCKED is allowed without a reason, and clears
    // the stored Blocker reason.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);
      await transitionItemState(prisma, {
        actorUserId: userId,
        itemId,
        state: "BLOCKED",
        blockerReason: "Stuck",
      });

      const result = await transitionItemState(prisma, { actorUserId: userId, itemId, state: "IN_PROGRESS" });
      assert.deepEqual(result, { status: "transitioned" });
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "IN_PROGRESS");
      assert.equal(item.blockerReason, null);
    }

    // A List Viewer cannot transition an Item's state.
    {
      const { listId, userId: viewerId } = await createWorkspaceWithListAndMember("MEMBER", "VIEWER");
      const creatorId = await createUser();
      const itemId = await createTestItem(listId, creatorId);

      const result = await transitionItemState(prisma, { actorUserId: viewerId, itemId, state: "COMPLETE" });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // archiveItem/restoreItem round-trip through the ARCHIVED state,
    // returning the Item to active use exactly as it was before archiving
    // — state, BlockerReason, Section, and Assignees all unchanged (#38).
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const sectionId = randomUUID();
      await prisma.section.create({ data: { id: sectionId, listId, name: "In Progress", order: 0 } });
      const itemId = await createTestItem(listId, userId);
      await prisma.item.update({ where: { id: itemId }, data: { sectionId } });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId } });
      await transitionItemState(prisma, {
        actorUserId: userId,
        itemId,
        state: "BLOCKED",
        blockerReason: "Waiting on vendor",
      });

      const before = await prisma.item.findUniqueOrThrow({
        where: { id: itemId },
        include: { assignees: true },
      });

      const archived = await archiveItem(prisma, { actorUserId: userId, itemId });
      assert.deepEqual(archived, { status: "transitioned" });
      const afterArchive = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(afterArchive.state, "ARCHIVED");
      assert.equal(afterArchive.stateBeforeArchive, "BLOCKED");

      const restored = await restoreItem(prisma, { actorUserId: userId, itemId });
      assert.deepEqual(restored, { status: "transitioned" });
      const after = await prisma.item.findUniqueOrThrow({
        where: { id: itemId },
        include: { assignees: true },
      });

      assert.equal(after.state, before.state, "restore returns the exact prior state, not TO_DO");
      assert.equal(after.blockerReason, before.blockerReason);
      assert.equal(after.sectionId, before.sectionId);
      assert.deepEqual(
        after.assignees.map((a) => a.userId),
        before.assignees.map((a) => a.userId)
      );
      assert.equal(after.stateBeforeArchive, null, "the restore marker is cleared once consumed");
    }

    // Restoring an Item archived without a recorded prior state (e.g. via a
    // path that predates stateBeforeArchive) falls back to TO_DO instead of
    // throwing.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);
      await prisma.item.update({
        where: { id: itemId },
        data: { state: "ARCHIVED", stateBeforeArchive: null },
      });

      const restored = await restoreItem(prisma, { actorUserId: userId, itemId });
      assert.deepEqual(restored, { status: "transitioned" });
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.state, "TO_DO");
    }

    // #104 story 7: every Item mutation in this module is refused with
    // list-archived once the Item's parent List is archived, even for a
    // Member who'd otherwise be allowed, with no observable side effect.
    {
      const { listId, userId } = await createWorkspaceWithListAndMember();
      const itemId = await createTestItem(listId, userId);
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      assert.deepEqual(await updateItem(prisma, { actorUserId: userId, itemId, title: "Nope" }), {
        status: "list-archived",
      });
      assert.deepEqual(
        await transitionItemState(prisma, { actorUserId: userId, itemId, state: "COMPLETE" }),
        { status: "list-archived" }
      );
      assert.deepEqual(await archiveItem(prisma, { actorUserId: userId, itemId }), {
        status: "list-archived",
      });
      assert.deepEqual(await restoreItem(prisma, { actorUserId: userId, itemId }), {
        status: "list-archived",
      });

      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.title, "Test Item");
      assert.equal(item.state, "TO_DO");
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

  console.log("item lifecycle integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
