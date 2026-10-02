import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadWorkspaceMembersPageData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace members page smoke test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name, email: `workspace-members-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(kind: "SHARED" | "PERSONAL", name: string): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind } });
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
    // Every role, including Member and Viewer, sees each member's Display
    // Name and role.
    {
      const workspaceId = await createWorkspace("SHARED", "Launch Team");
      const ownerId = await createUser("Zoe Owner");
      const adminId = await createUser("Amir Admin");
      const memberId = await createUser("Bo Member");
      const viewerId = await createUser("Vi Viewer");
      await addMember(workspaceId, ownerId, "OWNER");
      await addMember(workspaceId, adminId, "ADMIN");
      await addMember(workspaceId, memberId, "MEMBER");
      await addMember(workspaceId, viewerId, "VIEWER");

      for (const viewer of [ownerId, adminId, memberId, viewerId]) {
        const data = await loadWorkspaceMembersPageData(prisma, viewer, workspaceId);
        assert.ok(data, "expected members page data for every Workspace member");
        assert.deepEqual(
          data!.members.map(({ name, role }) => ({ name, role })),
          [
            { name: "Zoe Owner", role: "OWNER" },
            { name: "Amir Admin", role: "ADMIN" },
            { name: "Bo Member", role: "MEMBER" },
            { name: "Vi Viewer", role: "VIEWER" },
          ]
        );
      }
    }

    // A Personal Space has no members page.
    {
      const workspaceId = await createWorkspace("PERSONAL", "Personal Space");
      const ownerId = await createUser("Solo Owner");
      await addMember(workspaceId, ownerId, "OWNER");

      assert.equal(await loadWorkspaceMembersPageData(prisma, ownerId, workspaceId), null);
    }

    // A User who is not a member cannot access the page.
    {
      const workspaceId = await createWorkspace("SHARED", "Outsider Test");
      const strangerId = await createUser("Stranger");

      assert.equal(await loadWorkspaceMembersPageData(prisma, strangerId, workspaceId), null);
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace members page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
