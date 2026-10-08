import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { addListAccessByEmail } from "./list-access-by-email";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list access by email integration test skipped: DATABASE_URL is not set");
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
    const userEmail = email ?? `list-access-by-email-${userId}@example.test`;
    createdUserIds.push(userId);
    await prisma.user.create({ data: { id: userId, name: "Test User", email: userEmail } });
    return { userId, email: userEmail };
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  async function createListLead(workspaceId: string, listId: string): Promise<string> {
    const { userId: leadId } = await createUser();
    await addWorkspaceMember(workspaceId, leadId, "MEMBER");
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
    return leadId;
  }

  try {
    // Choosing Member for an email that already holds Workspace membership
    // adds a List Member.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const { userId: targetId, email } = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");

      const result = await addListAccessByEmail(prisma, { actorUserId: leadId, listId, email, role: "MEMBER" });

      assert.deepEqual(result, { status: "added" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "MEMBER");
    }

    // Choosing Viewer behaves the same way, for a Viewer role.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const { userId: targetId, email } = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");

      const result = await addListAccessByEmail(prisma, { actorUserId: leadId, listId, email, role: "VIEWER" });

      assert.deepEqual(result, { status: "added" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: targetId } } });
      assert.equal(membership?.role, "VIEWER");
    }

    // Choosing Member/Viewer for an email with no Workspace membership is
    // rejected (ADR 0009 — a List role requires an existing Workspace
    // membership).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const { userId: outsiderId, email } = await createUser();

      const result = await addListAccessByEmail(prisma, { actorUserId: leadId, listId, email, role: "MEMBER" });

      assert.deepEqual(result, { status: "user-lacks-workspace-membership" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: outsiderId } } });
      assert.equal(membership, null);
    }

    // An email with no matching account is reported rather than creating
    // anything.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);

      const result = await addListAccessByEmail(prisma, {
        actorUserId: leadId,
        listId,
        email: "nobody@example.test",
        role: "MEMBER",
      });

      assert.deepEqual(result, { status: "user-not-found" });
    }

    // A List Member (not Lead) cannot grant any role through this flow.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const { userId: memberId } = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });
      const { userId: targetId, email } = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");

      const result = await addListAccessByEmail(prisma, { actorUserId: memberId, listId, email, role: "VIEWER" });

      assert.deepEqual(result, { status: "forbidden" });
    }
  } finally {
    await prisma.listMember.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.list.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list access by email integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
