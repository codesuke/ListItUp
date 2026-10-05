import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { archiveList, restoreList, setListStatus, updateListDescription } from "./list-lifecycle";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list lifecycle integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `list-lifecycle-${userId}@example.test` },
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
    // A List Lead can archive a List; restoring clears archivedAt.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const archived = await archiveList(prisma, { userId: leadId, listId });
      assert.deepEqual(archived, { status: "archived" });
      let list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.ok(list.archivedAt, "List must be archived");

      const restored = await restoreList(prisma, { userId: leadId, listId });
      assert.deepEqual(restored, { status: "restored" });
      list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.archivedAt, null, "List must be restored");
    }

    // A Workspace Admin with no explicit List role cannot archive a List —
    // Admins have no implicit List access (ADR 0016).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");

      const result = await archiveList(prisma, { userId: adminId, listId });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // A Workspace Admin explicitly added as List Lead can archive it like
    // any other Lead.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      await addListMember(listId, adminId, "LEAD");

      const result = await archiveList(prisma, { userId: adminId, listId });
      assert.deepEqual(result, { status: "archived" });
    }

    // The Workspace Owner can archive a List without an explicit List role
    // (implicit Lead-equivalent access).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");

      const result = await archiveList(prisma, { userId: ownerId, listId });
      assert.deepEqual(result, { status: "archived" });
    }

    // A List Member (not Lead) cannot archive a List.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const result = await archiveList(prisma, { userId: memberId, listId });
      assert.deepEqual(result, { status: "forbidden" });
      const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.archivedAt, null, "List must remain active");
    }

    // A List Lead (or the Workspace Owner's implicit access) can set a
    // List's Status.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const result = await setListStatus(prisma, { userId: leadId, listId, status: "COMPLETED" });
      assert.deepEqual(result, { status: "updated" });
      const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.status, "COMPLETED");
    }

    // An invalid Status value is rejected before touching authorization.
    {
      const { listId } = await createWorkspaceWithList();
      const strangerId = await createUser();

      const result = await setListStatus(prisma, {
        userId: strangerId,
        listId,
        status: "NOT_A_REAL_STATUS",
      });
      assert.deepEqual(result, { status: "invalid-status" });
    }

    // A List Viewer cannot set Status.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");

      const result = await setListStatus(prisma, { userId: viewerId, listId, status: "ON_HOLD" });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // A List Lead (or the Workspace Owner's implicit access) can edit
    // Description (#27).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const result = await updateListDescription(prisma, {
        userId: leadId,
        listId,
        description: "  What this List is for.  ",
      });
      assert.deepEqual(result, { status: "updated" });
      const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.description, "What this List is for.");
    }

    // A List Member/Viewer cannot edit Description.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const result = await updateListDescription(prisma, {
        userId: memberId,
        listId,
        description: "Should not be saved.",
      });
      assert.deepEqual(result, { status: "forbidden" });
      const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.description, null);
    }

    // An empty Description is stored as null, not an empty string.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      await updateListDescription(prisma, { userId: leadId, listId, description: "   " });
      const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.description, null);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list lifecycle integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
