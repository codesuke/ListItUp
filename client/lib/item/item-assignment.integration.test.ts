import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { addAssignee, removeAssignee } from "./item-assignment";
import { transitionItemState } from "./item-lifecycle";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item assignment integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-assignment-${userId}@example.test` },
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
    // A List Member can add and remove an Assignee who has at least READ
    // access to the Item's List.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });
      const assigneeId = await createUser();
      await addWorkspaceMember(workspaceId, assigneeId, "MEMBER");
      await addListMember(listId, assigneeId, "MEMBER");

      const added = await addAssignee(prisma, { actorUserId: memberId, itemId: item.id, userId: assigneeId });
      assert.deepEqual(added, { status: "added" });
      let assignees = await prisma.itemAssignee.findMany({ where: { itemId: item.id } });
      assert.deepEqual(assignees.map((a) => a.userId), [assigneeId]);

      const removed = await removeAssignee(prisma, { actorUserId: memberId, itemId: item.id, userId: assigneeId });
      assert.deepEqual(removed, { status: "removed" });
      assignees = await prisma.itemAssignee.findMany({ where: { itemId: item.id } });
      assert.equal(assignees.length, 0);
    }

    // A List Viewer cannot add an Assignee.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");
      const creatorId = await createUser();
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId },
      });
      const assigneeId = await createUser();

      const result = await addAssignee(prisma, { actorUserId: viewerId, itemId: item.id, userId: assigneeId });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // #107/ADR 0021: assigning a User with zero access to the Item's List
    // is refused, even though the actor has WRITE — assignment can't be
    // used to leak a private Item to someone who shouldn't see it.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });
      const outsiderId = await createUser();

      const result = await addAssignee(prisma, { actorUserId: memberId, itemId: item.id, userId: outsiderId });
      assert.deepEqual(result, { status: "assignee-no-access" });
      const assignees = await prisma.itemAssignee.findMany({ where: { itemId: item.id } });
      assert.equal(assignees.length, 0, "no ItemAssignee row must be created");
    }

    // #107/ADR 0021: a target with only READ access — a List Viewer or a
    // Guest — remains a valid assignee, for visibility/FYI purposes even
    // though they can't act on the Item themselves.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });

      const viewerAssigneeId = await createUser();
      await addWorkspaceMember(workspaceId, viewerAssigneeId, "MEMBER");
      await addListMember(listId, viewerAssigneeId, "VIEWER");
      const viewerResult = await addAssignee(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        userId: viewerAssigneeId,
      });
      assert.deepEqual(viewerResult, { status: "added" });

      const guestAssigneeId = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: guestAssigneeId } });
      const guestResult = await addAssignee(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        userId: guestAssigneeId,
      });
      assert.deepEqual(guestResult, { status: "added" });
    }

    // Creator attribution stays fixed as Assignees change.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const creatorId = await createUser();
      await addWorkspaceMember(workspaceId, creatorId, "MEMBER");
      await addListMember(listId, creatorId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId },
      });
      const assigneeA = await createUser();
      await addWorkspaceMember(workspaceId, assigneeA, "MEMBER");
      await addListMember(listId, assigneeA, "MEMBER");
      const assigneeB = await createUser();
      await addWorkspaceMember(workspaceId, assigneeB, "MEMBER");
      await addListMember(listId, assigneeB, "MEMBER");

      await addAssignee(prisma, { actorUserId: creatorId, itemId: item.id, userId: assigneeA });
      await addAssignee(prisma, { actorUserId: creatorId, itemId: item.id, userId: assigneeB });
      await removeAssignee(prisma, { actorUserId: creatorId, itemId: item.id, userId: assigneeA });

      const reloaded = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(reloaded.creatorId, creatorId, "Creator must never change as Assignees change");
    }

    // Any single Assignee — not requiring every Assignee's agreement — can
    // transition a multi-Assignee Item to COMPLETE on their own.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const creatorId = await createUser();
      await addWorkspaceMember(workspaceId, creatorId, "MEMBER");
      await addListMember(listId, creatorId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Shared work", creatorId },
      });

      const assigneeA = await createUser();
      await addWorkspaceMember(workspaceId, assigneeA, "MEMBER");
      await addListMember(listId, assigneeA, "MEMBER");
      const assigneeB = await createUser();
      await addWorkspaceMember(workspaceId, assigneeB, "MEMBER");
      await addListMember(listId, assigneeB, "MEMBER");

      await addAssignee(prisma, { actorUserId: creatorId, itemId: item.id, userId: assigneeA });
      await addAssignee(prisma, { actorUserId: creatorId, itemId: item.id, userId: assigneeB });

      // assigneeA alone completes it — no confirmation from assigneeB.
      const result = await transitionItemState(prisma, {
        actorUserId: assigneeA,
        itemId: item.id,
        state: "COMPLETE",
      });
      assert.deepEqual(result, { status: "transitioned" });
      const reloaded = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(reloaded.state, "COMPLETE");
    }

    // #104 story 8: adding or removing an Assignee is refused with
    // list-archived once the Item's parent List is archived.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });
      const assigneeId = await createUser();
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: item.id, userId: assigneeId } });
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const added = await addAssignee(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        userId: await createUser(),
      });
      assert.deepEqual(added, { status: "list-archived" });

      const removed = await removeAssignee(prisma, { actorUserId: memberId, itemId: item.id, userId: assigneeId });
      assert.deepEqual(removed, { status: "list-archived" });

      const assignees = await prisma.itemAssignee.findMany({ where: { itemId: item.id } });
      assert.deepEqual(assignees.map((a) => a.userId), [assigneeId], "assignees must be untouched");
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

  console.log("item assignment integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
