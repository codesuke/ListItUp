import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { setPeerComparisonEnabled } from "./workspace-peer-comparison";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace peer comparison test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `peer-comparison-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Acme Studio", kind: "SHARED" } });
    return workspaceId;
  }

  async function joinWorkspace(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  try {
    // A Workspace Owner can turn the setting on.
    {
      const ownerId = await createUser();
      const workspaceId = await createWorkspace();
      await joinWorkspace(workspaceId, ownerId, "OWNER");

      const result = await setPeerComparisonEnabled(prisma, { userId: ownerId, workspaceId, enabled: true });
      assert.deepEqual(result, { status: "updated" });

      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      assert.equal(workspace.peerComparisonEnabled, true);
    }

    // A Workspace Admin can turn it back off.
    {
      const adminId = await createUser();
      const workspaceId = await createWorkspace();
      await joinWorkspace(workspaceId, adminId, "ADMIN");
      await prisma.workspace.update({ where: { id: workspaceId }, data: { peerComparisonEnabled: true } });

      const result = await setPeerComparisonEnabled(prisma, { userId: adminId, workspaceId, enabled: false });
      assert.deepEqual(result, { status: "updated" });

      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      assert.equal(workspace.peerComparisonEnabled, false);
    }

    // A regular Member is forbidden, and the setting is left untouched.
    {
      const memberId = await createUser();
      const workspaceId = await createWorkspace();
      await joinWorkspace(workspaceId, memberId, "MEMBER");

      const result = await setPeerComparisonEnabled(prisma, { userId: memberId, workspaceId, enabled: true });
      assert.deepEqual(result, { status: "forbidden" });

      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      assert.equal(workspace.peerComparisonEnabled, false);
    }

    // A soft-deleted Workspace refuses the change even for its Owner (#76)
    // — a Deleted Workspace is locked down everywhere.
    {
      const ownerId = await createUser();
      const workspaceId = await createWorkspace();
      await joinWorkspace(workspaceId, ownerId, "OWNER");
      await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });

      const result = await setPeerComparisonEnabled(prisma, { userId: ownerId, workspaceId, enabled: true });
      assert.deepEqual(result, { status: "forbidden" });

      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      assert.equal(workspace.peerComparisonEnabled, false);
    }

    // A non-Member of the Workspace is forbidden.
    {
      const outsiderId = await createUser();
      const workspaceId = await createWorkspace();

      const result = await setPeerComparisonEnabled(prisma, { userId: outsiderId, workspaceId, enabled: true });
      assert.deepEqual(result, { status: "forbidden" });
    }
  } finally {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace peer comparison test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
