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
    // A Workspace Admin with no List row cannot drag at all (ADR 0016: no
    // implicit List access for Admins).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: adminId, listId, userId: targetId, toRole: "VIEWER" });

      assert.deepEqual(result, { status: "forbidden" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "MEMBER", "the target's role must remain unchanged");
    }

    // A List Lead can drag a List Member into the Viewer column — the
    // drag board is gated at the same LEAD threshold as the Roles panel's
    // other controls.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: leadId, listId, userId: targetId, toRole: "VIEWER" });

      assert.deepEqual(result, { status: "moved" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "VIEWER");
    }

    // An Admin explicitly added to the List as a Lead can drag like any
    // other Lead.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: adminId, role: "LEAD" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: adminId, listId, userId: targetId, toRole: "VIEWER" });

      assert.deepEqual(result, { status: "moved" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "VIEWER");
    }

    // A Workspace Owner can drag a List Lead into the Guest column when
    // another Lead remains — the ListMember row is removed and replaced
    // with a Guest grant.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "LEAD" } });
      const otherLeadId = await createUser();
      await addWorkspaceMember(workspaceId, otherLeadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: otherLeadId, role: "LEAD" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: ownerId, listId, userId: targetId, toRole: "GUEST" });

      assert.deepEqual(result, { status: "moved" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership, null);
      const guest = await prisma.guest.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.ok(guest);
    }

    // Dragging a List's only Lead into the Guest, Member, or Viewer column
    // is blocked (#95) — the invariant holds for a Workspace Owner too.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const soleLeadId = await createUser();
      await addWorkspaceMember(workspaceId, soleLeadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: soleLeadId, role: "LEAD" } });

      const result = await moveListRoleAssignment(prisma, {
        actorUserId: ownerId,
        listId,
        userId: soleLeadId,
        toRole: "GUEST",
      });

      assert.deepEqual(result, { status: "last-lead" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: soleLeadId } } });
      assert.equal(membership?.role, "LEAD", "the sole Lead must remain a List Lead");
    }

    // Dragging a Guest who already holds Workspace membership into the
    // Member column removes the Guest grant and adds a List Member row.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: targetId } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: leadId, listId, userId: targetId, toRole: "MEMBER" });

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
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
      const outsiderId = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: outsiderId } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: leadId, listId, userId: outsiderId, toRole: "MEMBER" });

      assert.deepEqual(result, { status: "user-lacks-workspace-membership" });
      const guest = await prisma.guest.findUnique({ where: { listId_userId: { listId, userId: outsiderId } } });
      assert.ok(guest, "the existing Guest grant must remain untouched");
    }

    // A List Member (below the LEAD threshold) cannot drag.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await moveListRoleAssignment(prisma, { actorUserId: memberId, listId, userId: targetId, toRole: "VIEWER" });

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

    // #104 story 2: dragging a person on the Roles kanban is refused with
    // list-archived once the List is archived, even for a Lead.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const result = await moveListRoleAssignment(prisma, {
        actorUserId: leadId,
        listId,
        userId: targetId,
        toRole: "VIEWER",
      });

      assert.deepEqual(result, { status: "list-archived" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "MEMBER", "the target's role must remain unchanged");
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
