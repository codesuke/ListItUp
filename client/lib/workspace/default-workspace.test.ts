import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { resolveDefaultWorkspaceId } from "./default-workspace";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("default workspace test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `default-workspace-${userId}@example.test` },
    });
    return userId;
  }

  async function joinWorkspace(
    kind: "SHARED" | "PERSONAL",
    name: string,
    userId: string,
    createdAt?: Date
  ): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name,
        kind,
        members: { create: [{ id: randomUUID(), userId, role: "MEMBER", createdAt }] },
      },
    });
    return workspaceId;
  }

  try {
    // A User with no Workspace membership at all (mid-verification) gets
    // no default rather than an arbitrary Workspace.
    {
      const userId = await createUser();
      assert.equal(await resolveDefaultWorkspaceId(prisma, userId), null);
    }

    // A User with only a Personal Space lands there.
    {
      const userId = await createUser();
      const personalId = await joinWorkspace("PERSONAL", "Personal Space", userId);
      assert.equal(await resolveDefaultWorkspaceId(prisma, userId), personalId);
    }

    // A User who belongs to multiple SHARED Workspaces lands in the oldest
    // one they joined, not their Personal Space.
    {
      const userId = await createUser();
      await joinWorkspace("PERSONAL", "Personal Space", userId);
      await joinWorkspace("SHARED", "Newer Co", userId, new Date("2026-02-01"));
      const olderSharedId = await joinWorkspace("SHARED", "Older Co", userId, new Date("2026-01-01"));

      assert.equal(await resolveDefaultWorkspaceId(prisma, userId), olderSharedId);
    }

    // A Deleted Workspace is skipped even when it's the oldest SHARED one
    // the User joined, falling back to the next-oldest live one (#76).
    {
      const userId = await createUser();
      const deletedId = await joinWorkspace("SHARED", "Retired Co", userId, new Date("2026-01-01"));
      const liveId = await joinWorkspace("SHARED", "Newer Co", userId, new Date("2026-02-01"));
      await prisma.workspace.update({ where: { id: deletedId }, data: { deletedAt: new Date() } });

      assert.equal(await resolveDefaultWorkspaceId(prisma, userId), liveId);
    }

    // When every SHARED Workspace is deleted, the User falls back to their
    // Personal Space just as if they belonged to no SHARED Workspace at all.
    {
      const userId = await createUser();
      const personalId = await joinWorkspace("PERSONAL", "Personal Space", userId);
      const deletedId = await joinWorkspace("SHARED", "Retired Co", userId);
      await prisma.workspace.update({ where: { id: deletedId }, data: { deletedAt: new Date() } });

      assert.equal(await resolveDefaultWorkspaceId(prisma, userId), personalId);
    }
  } finally {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("default workspace test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
