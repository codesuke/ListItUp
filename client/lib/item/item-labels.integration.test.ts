import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { applyLabel, removeLabel } from "./item-labels";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item labels integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-labels-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceListAndLabel(): Promise<{ workspaceId: string; listId: string; labelId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    const label = await prisma.label.create({ data: { id: randomUUID(), workspaceId, name: "Bug" } });
    return { workspaceId, listId, labelId: label.id };
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
    // Any List Member with Item access can apply an existing Label — not
    // gated by Label-creation rights (a plain Member, not Owner/Admin).
    {
      const { workspaceId, listId, labelId } = await createWorkspaceListAndLabel();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });

      const result = await applyLabel(prisma, { actorUserId: memberId, itemId: item.id, labelId });
      assert.deepEqual(result, { status: "applied" });
      const applied = await prisma.itemLabel.findMany({ where: { itemId: item.id } });
      assert.deepEqual(applied.map((a) => a.labelId), [labelId]);

      const removed = await removeLabel(prisma, { actorUserId: memberId, itemId: item.id, labelId });
      assert.deepEqual(removed, { status: "removed" });
      const remaining = await prisma.itemLabel.findMany({ where: { itemId: item.id } });
      assert.equal(remaining.length, 0);
    }

    // A List Viewer cannot apply a Label.
    {
      const { workspaceId, listId, labelId } = await createWorkspaceListAndLabel();
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");
      const creatorId = await createUser();
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId },
      });

      const result = await applyLabel(prisma, { actorUserId: viewerId, itemId: item.id, labelId });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // A Label from a different Workspace cannot be applied.
    {
      const { listId } = await createWorkspaceListAndLabel();
      const memberId = await createUser();
      const otherWorkspaceId = randomUUID();
      createdWorkspaceIds.push(otherWorkspaceId);
      await prisma.workspace.create({ data: { id: otherWorkspaceId, name: "Other Workspace" } });
      const foreignLabel = await prisma.label.create({
        data: { id: randomUUID(), workspaceId: otherWorkspaceId, name: "Foreign" },
      });
      const workspaceIdForList = (await prisma.list.findUniqueOrThrow({ where: { id: listId } })).workspaceId;
      await addWorkspaceMember(workspaceIdForList, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });

      const result = await applyLabel(prisma, { actorUserId: memberId, itemId: item.id, labelId: foreignLabel.id });
      assert.deepEqual(result, { status: "label-not-in-workspace" });
    }

    // #104 story 8: applying or removing a Label is refused with
    // list-archived once the Item's parent List is archived.
    {
      const { workspaceId, listId, labelId } = await createWorkspaceListAndLabel();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });
      await prisma.itemLabel.create({ data: { id: randomUUID(), itemId: item.id, labelId } });
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const otherLabel = await prisma.label.create({ data: { id: randomUUID(), workspaceId, name: "Other" } });
      const applied = await applyLabel(prisma, { actorUserId: memberId, itemId: item.id, labelId: otherLabel.id });
      assert.deepEqual(applied, { status: "list-archived" });

      const removed = await removeLabel(prisma, { actorUserId: memberId, itemId: item.id, labelId });
      assert.deepEqual(removed, { status: "list-archived" });

      const current = await prisma.itemLabel.findMany({ where: { itemId: item.id } });
      assert.deepEqual(current.map((a) => a.labelId), [labelId], "labels must be untouched");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemLabel.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.label.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("item labels integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
