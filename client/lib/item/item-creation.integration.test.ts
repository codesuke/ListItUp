import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createItem } from "./item-creation";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item creation integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-creation-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithList(): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    return { workspaceId, listId };
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  async function addListMember(
    listId: string,
    userId: string,
    role: "LEAD" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
  }

  try {
    // A List Member can create an Item with title, Section, Assignees,
    // Priority, and due date.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const sectionId = randomUUID();
      await prisma.section.create({ data: { id: sectionId, listId, name: "To Do", order: 0 } });
      const assigneeId = await createUser();
      const dueDate = new Date("2026-10-01T00:00:00.000Z");

      const result = await createItem(prisma, {
        actorUserId: memberId,
        listId,
        title: "Ship the thing",
        sectionId,
        priority: "HIGH",
        dueDate,
        assigneeUserIds: [assigneeId],
      });

      assert.equal(result.status, "created");
      const itemId = result.status === "created" ? result.itemId : "";
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.title, "Ship the thing");
      assert.equal(item.sectionId, sectionId);
      assert.equal(item.priority, "HIGH");
      assert.equal(item.dueDate?.toISOString(), dueDate.toISOString());
      assert.equal(item.creatorId, memberId);
      assert.equal(item.state, "TO_DO");

      const assignees = await prisma.itemAssignee.findMany({ where: { itemId } });
      assert.deepEqual(assignees.map((a) => a.userId), [assigneeId]);
    }

    // A List Viewer cannot create an Item.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");

      const result = await createItem(prisma, { actorUserId: viewerId, listId, title: "Should not exist" });
      assert.deepEqual(result, { status: "forbidden" });
      const items = await prisma.item.findMany({ where: { listId } });
      assert.equal(items.length, 0);
    }

    // A Guest cannot create an Item.
    {
      const { listId } = await createWorkspaceWithList();
      const guestId = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: guestId } });

      const result = await createItem(prisma, { actorUserId: guestId, listId, title: "Should not exist" });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // A List Member can create a nested child Item under any Item, at
    // arbitrary depth, via the self-referencing parent field.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const top = await createItem(prisma, { actorUserId: memberId, listId, title: "Top" });
      assert.equal(top.status, "created");
      const topId = top.status === "created" ? top.itemId : "";

      const child = await createItem(prisma, {
        actorUserId: memberId,
        listId,
        title: "Child",
        parentId: topId,
      });
      assert.equal(child.status, "created");
      const childId = child.status === "created" ? child.itemId : "";

      const grandchild = await createItem(prisma, {
        actorUserId: memberId,
        listId,
        title: "Grandchild",
        parentId: childId,
      });
      assert.equal(grandchild.status, "created");
      const grandchildId = grandchild.status === "created" ? grandchild.itemId : "";

      const grandchildRow = await prisma.item.findUniqueOrThrow({ where: { id: grandchildId } });
      assert.equal(grandchildRow.parentId, childId);
      const childRow = await prisma.item.findUniqueOrThrow({ where: { id: childId } });
      assert.equal(childRow.parentId, topId);
    }

    // A parent Item from a different List is rejected.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const { listId: otherListId } = await createWorkspaceWithList();
      const foreignItem = await prisma.item.create({
        data: { id: randomUUID(), listId: otherListId, title: "Elsewhere", creatorId: memberId },
      });

      const result = await createItem(prisma, {
        actorUserId: memberId,
        listId,
        title: "Should not exist",
        parentId: foreignItem.id,
      });
      assert.deepEqual(result, { status: "parent-not-in-list" });
    }

    // A non-existent parent Item is rejected.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const result = await createItem(prisma, {
        actorUserId: memberId,
        listId,
        title: "Should not exist",
        parentId: randomUUID(),
      });
      assert.deepEqual(result, { status: "parent-not-found" });
    }

    // #104 story 6: a Member is refused with list-archived when creating
    // an Item on an archived List, and no Item is created.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const result = await createItem(prisma, { actorUserId: memberId, listId, title: "Should not exist" });
      assert.deepEqual(result, { status: "list-archived" });
      const itemCount = await prisma.item.count({ where: { listId } });
      assert.equal(itemCount, 0);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.section.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.guest.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("item creation integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
