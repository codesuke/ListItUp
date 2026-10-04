import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { deleteWorkspace } from "./workspace-deletion";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace deletion test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name, email: `workspace-deletion-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(
    kind: "SHARED" | "PERSONAL",
    name: string,
    options: { isDemo?: boolean } = {}
  ): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: { id: workspaceId, name, kind, isDemo: options.isDemo ?? false },
    });
    return workspaceId;
  }

  async function addMember(
    workspaceId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<string> {
    const userId = await createUser(role);
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });
    return userId;
  }

  async function deletionState(
    workspaceId: string
  ): Promise<{ deletedAt: Date | null; deletedByUserId: string | null }> {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    return { deletedAt: workspace.deletedAt, deletedByUserId: workspace.deletedByUserId };
  }

  try {
    // The Owner of a SHARED Workspace can delete it; the Workspace is
    // marked deleted with who deleted it recorded.
    {
      const workspaceId = await createWorkspace("SHARED", "Launch Team");
      const ownerId = await addMember(workspaceId, "OWNER");

      const result = await deleteWorkspace(prisma, workspaceId, ownerId);

      assert.deepEqual(result, { status: "deleted" });
      const state = await deletionState(workspaceId);
      assert.ok(state.deletedAt, "deletedAt must be set");
      assert.equal(state.deletedByUserId, ownerId);
    }

    // The Demo Workspace is deletable like any other SHARED Workspace.
    {
      const workspaceId = await createWorkspace("SHARED", "Demo Workspace", { isDemo: true });
      const ownerId = await addMember(workspaceId, "OWNER");

      const result = await deleteWorkspace(prisma, workspaceId, ownerId);

      assert.deepEqual(result, { status: "deleted" });
    }

    // Admin, Member and Viewer cannot delete — including via a crafted
    // Server Action call that bypasses the UI's Owner-only gating.
    for (const role of ["ADMIN", "MEMBER", "VIEWER"] as const) {
      const workspaceId = await createWorkspace("SHARED", `${role} Co`);
      await addMember(workspaceId, "OWNER");
      const nonOwnerId = await addMember(workspaceId, role);

      const result = await deleteWorkspace(prisma, workspaceId, nonOwnerId);

      assert.deepEqual(result, { status: "not-owner" }, `${role} must not be able to delete`);
      const state = await deletionState(workspaceId);
      assert.equal(state.deletedAt, null, `${role}'s attempt must not have deleted the Workspace`);
    }

    // A non-member gets "not-found" rather than a result that reveals the
    // Workspace exists.
    {
      const workspaceId = await createWorkspace("SHARED", "Outsider Co");
      await addMember(workspaceId, "OWNER");
      const strangerId = await createUser("Stranger");

      const result = await deleteWorkspace(prisma, workspaceId, strangerId);

      assert.deepEqual(result, { status: "not-found" });
    }

    // An unknown workspaceId also reports "not-found".
    {
      const strangerId = await createUser("Stranger");
      const result = await deleteWorkspace(prisma, randomUUID(), strangerId);
      assert.deepEqual(result, { status: "not-found" });
    }

    // A Personal Space can never be deleted, even by its sole Owner.
    {
      const workspaceId = await createWorkspace("PERSONAL", "Personal Space");
      const ownerId = await addMember(workspaceId, "OWNER");

      const result = await deleteWorkspace(prisma, workspaceId, ownerId);

      assert.deepEqual(result, { status: "personal-space" });
      const state = await deletionState(workspaceId);
      assert.equal(state.deletedAt, null);
    }

    // Deleting an already-deleted Workspace is refused harmlessly, and
    // doesn't clobber who originally deleted it.
    {
      const workspaceId = await createWorkspace("SHARED", "Twice Deleted Co");
      const ownerId = await addMember(workspaceId, "OWNER");

      const first = await deleteWorkspace(prisma, workspaceId, ownerId);
      assert.deepEqual(first, { status: "deleted" });
      const stateAfterFirst = await deletionState(workspaceId);

      const second = await deleteWorkspace(prisma, workspaceId, ownerId);
      assert.deepEqual(second, { status: "already-deleted" });
      const stateAfterSecond = await deletionState(workspaceId);

      assert.deepEqual(
        stateAfterSecond,
        stateAfterFirst,
        "a refused repeat delete must not change the recorded deletion"
      );
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace deletion test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
