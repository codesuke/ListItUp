import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadDeletedWorkspacesPageData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("deleted workspaces page smoke test skipped: DATABASE_URL is not set");
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

  async function createUser(name: string): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name, email: `deleted-workspaces-page-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(name: string, deletedAt: Date | null): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: { id: workspaceId, name, kind: "SHARED", deletedAt },
    });
    return workspaceId;
  }

  async function addMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });
  }

  try {
    // The Owner sees only the Workspaces they own that are deleted, with
    // days remaining counted down from the 3-month Restore Window.
    {
      const ownerId = await createUser("Zoe Owner");
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 1);
      const deletedWorkspaceId = await createWorkspace("Launch Team", deletedAt);
      await addMember(deletedWorkspaceId, ownerId, "OWNER");

      const activeWorkspaceId = await createWorkspace("Active Co", null);
      await addMember(activeWorkspaceId, ownerId, "OWNER");

      const rows = await loadDeletedWorkspacesPageData(prisma, ownerId);

      assert.deepEqual(rows.map((row) => row.id), [deletedWorkspaceId]);
      assert.equal(rows[0].name, "Launch Team");
      assert.ok(
        rows[0].daysRemaining >= 85 && rows[0].daysRemaining <= 92,
        `expected daysRemaining near 90, got ${rows[0].daysRemaining}`
      );
    }

    // An Admin of a deleted Workspace sees nothing — only the Owner can
    // restore, so only the Owner sees it listed.
    {
      const ownerId = await createUser("Owner");
      const adminId = await createUser("Admin");
      const deletedWorkspaceId = await createWorkspace("Design Guild", new Date());
      await addMember(deletedWorkspaceId, ownerId, "OWNER");
      await addMember(deletedWorkspaceId, adminId, "ADMIN");

      const rows = await loadDeletedWorkspacesPageData(prisma, adminId);

      assert.deepEqual(rows, []);
    }

    // A User who owns no deleted Workspaces sees an empty list.
    {
      const ownerId = await createUser("No Deletions Owner");

      const rows = await loadDeletedWorkspacesPageData(prisma, ownerId);

      assert.deepEqual(rows, []);
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("deleted workspaces page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
