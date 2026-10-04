import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { moveListRoleAssignment } from "./list-role-board";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list role board integration test skipped: DATABASE_URL is not set");
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
  const createdListIds: string[] = [];

  async function createWorkspaceWithList(): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    createdListIds.push(listId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    return { workspaceId, listId };
  }

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({ data: { id: userId, name: "Test User", email: `list-role-board-${userId}@example.test` } });
    return userId;
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  try {
    // A Workspace Admin can drag a List Member into the Viewer column.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: adminId, listId, userId: targetId, toRole: "VIEWER" });

      assert.deepEqual(result, { status: "moved" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "VIEWER");
    }

    // A Workspace Owner can drag a List Lead into the Guest column — the
    // ListMember row is removed and replaced with a Guest grant.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "LEAD" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: ownerId, listId, userId: targetId, toRole: "GUEST" });

      assert.deepEqual(result, { status: "moved" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership, null);
      const guest = await prisma.guest.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.ok(guest);
    }

    // Dragging a Guest who already holds Workspace membership into the
    // Member column removes the Guest grant and adds a List Member row.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: targetId } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: adminId, listId, userId: targetId, toRole: "MEMBER" });

      assert.deepEqual(result, { status: "moved" });
      const guest = await prisma.guest.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(guest, null);
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "MEMBER");
    }

    // Dragging a Guest with no Workspace membership into the Member column
    // is rejected, and the existing Guest grant is left untouched.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      const outsiderId = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: outsiderId } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: adminId, listId, userId: outsiderId, toRole: "MEMBER" });

      assert.deepEqual(result, { status: "user-lacks-workspace-membership" });
      const guest = await prisma.guest.findUnique({ where: { listId_userId: { listId, userId: outsiderId } } });
      assert.ok(guest, "the existing Guest grant must remain untouched");
    }

    // A List Lead (not a Workspace Owner/Admin) cannot drag — this board
    // is scoped tighter than the panel's other Lead-level controls.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: leadId, listId, userId: targetId, toRole: "VIEWER" });

      assert.deepEqual(result, { status: "forbidden" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "MEMBER", "the target's role must remain unchanged");
    }

    // A non-existent List is reported rather than silently no-op-ing.
    {
      const actorId = await createUser();
      const targetId = await createUser();

      const result = await moveListRoleAssignment(prisma, {
        actorUserId: actorId,
        listId: randomUUID(),
        userId: targetId,
        toRole: "MEMBER",
      });

      assert.deepEqual(result, { status: "list-not-found" });
    }
  } finally {
    await prisma.guest.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.list.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list role board integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
