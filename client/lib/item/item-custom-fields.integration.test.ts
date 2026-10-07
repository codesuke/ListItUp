import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { setCustomFieldValue } from "./item-custom-fields";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item custom fields integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-cf-${userId}@example.test` },
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
    // Any List Member (not just Lead) can set a Custom Field's value.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const definition = await prisma.customFieldDefinition.create({
        data: { id: randomUUID(), listId, name: "Clearance (mm)", type: "NUMBER" },
      });
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });

      const result = await setCustomFieldValue(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        definitionId: definition.id,
        value: "1240",
      });
      assert.deepEqual(result, { status: "set" });
      const stored = await prisma.customFieldValue.findUniqueOrThrow({
        where: { itemId_definitionId: { itemId: item.id, definitionId: definition.id } },
      });
      assert.equal(stored.value, "1240");

      // Setting again updates the same row rather than duplicating it.
      await setCustomFieldValue(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        definitionId: definition.id,
        value: "1300",
      });
      const values = await prisma.customFieldValue.findMany({ where: { itemId: item.id } });
      assert.equal(values.length, 1);
      assert.equal(values[0].value, "1300");
    }

    // A List Viewer cannot set a Custom Field's value.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");
      const definition = await prisma.customFieldDefinition.create({
        data: { id: randomUUID(), listId, name: "Notes", type: "TEXT" },
      });
      const creatorId = await createUser();
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId },
      });

      const result = await setCustomFieldValue(prisma, {
        actorUserId: viewerId,
        itemId: item.id,
        definitionId: definition.id,
        value: "Should not be saved",
      });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // An invalid value for the definition's type is rejected.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const definition = await prisma.customFieldDefinition.create({
        data: { id: randomUUID(), listId, name: "Status", type: "DROPDOWN", options: ["Open", "Closed"] },
      });
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });

      const result = await setCustomFieldValue(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        definitionId: definition.id,
        value: "Not an option",
      });
      assert.deepEqual(result, { status: "invalid-value" });
    }

    // A definition from a different List cannot be set on this Item.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });

      const { listId: otherListId } = await createWorkspaceWithList();
      const foreignDefinition = await prisma.customFieldDefinition.create({
        data: { id: randomUUID(), listId: otherListId, name: "Foreign", type: "TEXT" },
      });

      const result = await setCustomFieldValue(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        definitionId: foreignDefinition.id,
        value: "Should not be saved",
      });
      assert.deepEqual(result, { status: "definition-not-in-list" });
    }

    // #104 story 8: setting a Custom Field's value is refused with
    // list-archived once the Item's parent List is archived.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const definition = await prisma.customFieldDefinition.create({
        data: { id: randomUUID(), listId, name: "Notes", type: "TEXT" },
      });
      const item = await prisma.item.create({
        data: { id: randomUUID(), listId, title: "Test Item", creatorId: memberId },
      });
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const result = await setCustomFieldValue(prisma, {
        actorUserId: memberId,
        itemId: item.id,
        definitionId: definition.id,
        value: "Should not be saved",
      });
      assert.deepEqual(result, { status: "list-archived" });
      const stored = await prisma.customFieldValue.findUnique({
        where: { itemId_definitionId: { itemId: item.id, definitionId: definition.id } },
      });
      assert.equal(stored, null);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.customFieldValue.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.customFieldDefinition.deleteMany({ where: { listId: { in: listIds } } });
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

  console.log("item custom fields integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
