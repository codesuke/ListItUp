import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { grantGuestAccess, revokeGuestAccess } from "./list-guests";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list guests integration test skipped: DATABASE_URL is not set");
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

  async function createUser(email?: string): Promise<{ userId: string; email: string }> {
    const userId = randomUUID();
    const userEmail = email ?? `list-guests-${userId}@example.test`;
    createdUserIds.push(userId);
    await prisma.user.create({ data: { id: userId, name: "Test User", email: userEmail } });
    return { userId, email: userEmail };
  }

  async function createListLead(workspaceId: string, listId: string): Promise<string> {
    const { userId: leadId } = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: leadId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
    return leadId;
  }

  try {
    // A List Lead can grant Guest access by email, without the target
    // holding any Workspace membership.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const { userId: guestUserId, email } = await createUser();

      const result = await grantGuestAccess(prisma, { actorUserId: leadId, listId, email });

      assert.deepEqual(result, { status: "granted" });
      const guest = await prisma.guest.findUnique({
        where: { listId_userId: { listId, userId: guestUserId } },
      });
      assert.ok(guest);
    }

    // A Workspace Admin with no explicit List role cannot grant Guest
    // access — Admins have no implicit List access (ADR 0016).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const { userId: adminId } = await createUser();
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: adminId, role: "ADMIN" } });
      const { email } = await createUser();

      const result = await grantGuestAccess(prisma, { actorUserId: adminId, listId, email });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // A Workspace Admin explicitly added as List Lead can grant Guest
    // access like any other Lead.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const { userId: adminId } = await createUser();
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: adminId, role: "ADMIN" } });
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: adminId, role: "LEAD" } });
      const { userId: guestUserId, email } = await createUser();

      const result = await grantGuestAccess(prisma, { actorUserId: adminId, listId, email });
      assert.deepEqual(result, { status: "granted" });
      const guest = await prisma.guest.findUnique({
        where: { listId_userId: { listId, userId: guestUserId } },
      });
      assert.ok(guest);
    }

    // The Workspace Owner can grant Guest access without an explicit List
    // role (implicit Lead-equivalent access).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const { userId: ownerId } = await createUser();
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" } });
      const { userId: guestUserId, email } = await createUser();

      const result = await grantGuestAccess(prisma, { actorUserId: ownerId, listId, email });
      assert.deepEqual(result, { status: "granted" });
      const guest = await prisma.guest.findUnique({
        where: { listId_userId: { listId, userId: guestUserId } },
      });
      assert.ok(guest);
    }

    // A List Member (not Lead) cannot grant Guest access.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const { userId: memberId } = await createUser();
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" } });
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });
      const { email } = await createUser();

      const result = await grantGuestAccess(prisma, { actorUserId: memberId, listId, email });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // Granting Guest access to an email with no matching account is
    // reported rather than silently doing nothing.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);

      const result = await grantGuestAccess(prisma, {
        actorUserId: leadId,
        listId,
        email: "nobody@example.test",
      });
      assert.deepEqual(result, { status: "user-not-found" });
    }

    // A List Lead can revoke Guest access.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const { userId: guestUserId } = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: guestUserId } });

      const result = await revokeGuestAccess(prisma, { actorUserId: leadId, listId, userId: guestUserId });

      assert.deepEqual(result, { status: "revoked" });
      const guest = await prisma.guest.findUnique({
        where: { listId_userId: { listId, userId: guestUserId } },
      });
      assert.equal(guest, null);
    }

    // A List Viewer cannot revoke Guest access.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const { userId: viewerId } = await createUser();
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: viewerId, role: "MEMBER" } });
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: viewerId, role: "VIEWER" } });
      const { userId: guestUserId } = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: guestUserId } });

      const result = await revokeGuestAccess(prisma, { actorUserId: viewerId, listId, userId: guestUserId });

      assert.deepEqual(result, { status: "forbidden" });
      const guest = await prisma.guest.findUnique({
        where: { listId_userId: { listId, userId: guestUserId } },
      });
      assert.ok(guest, "Guest access must remain granted");
    }
  } finally {
    await prisma.guest.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.list.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list guests integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
