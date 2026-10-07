import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createLabel } from "./list-labels";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list labels integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `list-labels-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(kind: "SHARED" | "PERSONAL" = "SHARED"): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace", kind } });
    return workspaceId;
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  try {
    // A Workspace Owner can create a Label in a shared Workspace.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");

      const result = await createLabel(prisma, { actorUserId: ownerId, workspaceId, name: "Urgent" });
      assert.equal(result.status, "created");
    }

    // A Workspace Member without Admin/Owner rights is rejected.
    {
      const workspaceId = await createWorkspace();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");

      const result = await createLabel(prisma, { actorUserId: memberId, workspaceId, name: "Should not exist" });
      assert.deepEqual(result, { status: "forbidden" });
      const labels = await prisma.label.findMany({ where: { workspaceId } });
      assert.equal(labels.length, 0);
    }

    // Personal Space Label creation is unrestricted — the sole member is
    // always OWNER of their own Personal Space, so this needs no special
    // case beyond the same Owner/Admin check.
    {
      const workspaceId = await createWorkspace("PERSONAL");
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");

      const result = await createLabel(prisma, { actorUserId: ownerId, workspaceId, name: "Personal" });
      assert.equal(result.status, "created");
    }

    // A soft-deleted Workspace refuses Label creation even for its Owner
    // (#76) — a Deleted Workspace is locked down everywhere.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });

      const result = await createLabel(prisma, { actorUserId: ownerId, workspaceId, name: "Should not exist" });
      assert.deepEqual(result, { status: "forbidden" });
      const labels = await prisma.label.findMany({ where: { workspaceId } });
      assert.equal(labels.length, 0);
    }

    // Duplicate names within the same Workspace are rejected.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      await createLabel(prisma, { actorUserId: ownerId, workspaceId, name: "Bug" });

      const result = await createLabel(prisma, { actorUserId: ownerId, workspaceId, name: "Bug" });
      assert.deepEqual(result, { status: "duplicate-name" });
    }
  } finally {
    await prisma.label.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list labels integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
