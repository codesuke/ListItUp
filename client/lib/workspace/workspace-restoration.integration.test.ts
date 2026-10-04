import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { deleteWorkspace, restoreWorkspace, RESTORE_WINDOW_MONTHS } from "./workspace-deletion";
import { acceptInvitation } from "./workspace-invitations";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace restoration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name, email: `workspace-restoration-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(
    kind: "SHARED" | "PERSONAL",
    name: string
  ): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind } });
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

  async function backdateDeletion(workspaceId: string, deletedAt: Date): Promise<void> {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt } });
  }

  async function deletionState(
    workspaceId: string
  ): Promise<{ deletedAt: Date | null; deletedByUserId: string | null }> {
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    return { deletedAt: workspace.deletedAt, deletedByUserId: workspace.deletedByUserId };
  }

  try {
    // The Owner can restore within the Restore Window, and everything that
    // was never touched by the soft delete — the List, its Item, the
    // members and their roles, the Owner's own role — is unchanged.
    {
      const workspaceId = await createWorkspace("SHARED", "Launch Team");
      const ownerId = await addMember(workspaceId, "OWNER");
      const memberId = await addMember(workspaceId, "MEMBER");
      const listId = randomUUID();
      await prisma.list.create({
        data: { id: listId, workspaceId, name: "Sprint Board" },
      });
      const itemId = randomUUID();
      await prisma.item.create({
        data: { id: itemId, listId, title: "Ship the thing", creatorId: ownerId },
      });

      const deleteResult = await deleteWorkspace(prisma, workspaceId, ownerId);
      assert.deepEqual(deleteResult, { status: "deleted" });

      const restoreResult = await restoreWorkspace(prisma, workspaceId, ownerId);

      assert.deepEqual(restoreResult, { status: "restored" });
      const state = await deletionState(workspaceId);
      assert.equal(state.deletedAt, null, "restore must clear deletedAt");
      assert.equal(state.deletedByUserId, null, "restore must clear deletedByUserId");

      const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
      assert.equal(list.workspaceId, workspaceId);
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      assert.equal(item.title, "Ship the thing");
      const ownerMembership = await prisma.workspaceMember.findUniqueOrThrow({
        where: { workspaceId_userId: { workspaceId, userId: ownerId } },
      });
      assert.equal(ownerMembership.role, "OWNER", "the Owner must still be Owner after restore");
      const memberMembership = await prisma.workspaceMember.findUniqueOrThrow({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });
      assert.equal(memberMembership.role, "MEMBER");
    }

    // Restore after the Restore Window has closed is refused, and the
    // Workspace stays deleted.
    {
      const workspaceId = await createWorkspace("SHARED", "Stale Co");
      const ownerId = await addMember(workspaceId, "OWNER");
      const expiredDeletion = new Date();
      expiredDeletion.setMonth(expiredDeletion.getMonth() - RESTORE_WINDOW_MONTHS - 1);
      await backdateDeletion(workspaceId, expiredDeletion);

      const result = await restoreWorkspace(prisma, workspaceId, ownerId);

      assert.deepEqual(result, { status: "window-expired" });
      const state = await deletionState(workspaceId);
      assert.ok(state.deletedAt, "the Workspace must remain deleted after a refused restore");
    }

    // Admin, Member and Viewer cannot restore — including via a crafted
    // Server Action call that bypasses the UI's Owner-only gating.
    for (const role of ["ADMIN", "MEMBER", "VIEWER"] as const) {
      const workspaceId = await createWorkspace("SHARED", `${role} Restore Co`);
      const ownerId = await addMember(workspaceId, "OWNER");
      const nonOwnerId = await addMember(workspaceId, role);
      await deleteWorkspace(prisma, workspaceId, ownerId);

      const result = await restoreWorkspace(prisma, workspaceId, nonOwnerId);

      assert.deepEqual(result, { status: "not-owner" }, `${role} must not be able to restore`);
      const state = await deletionState(workspaceId);
      assert.ok(state.deletedAt, `${role}'s attempt must not have restored the Workspace`);
    }

    // A non-member gets "not-found" rather than a result that reveals the
    // Workspace exists.
    {
      const workspaceId = await createWorkspace("SHARED", "Outsider Restore Co");
      const ownerId = await addMember(workspaceId, "OWNER");
      await deleteWorkspace(prisma, workspaceId, ownerId);
      const strangerId = await createUser("Stranger");

      const result = await restoreWorkspace(prisma, workspaceId, strangerId);

      assert.deepEqual(result, { status: "not-found" });
    }

    // Restoring a Workspace that isn't deleted is refused harmlessly.
    {
      const workspaceId = await createWorkspace("SHARED", "Never Deleted Co");
      const ownerId = await addMember(workspaceId, "OWNER");

      const result = await restoreWorkspace(prisma, workspaceId, ownerId);

      assert.deepEqual(result, { status: "not-deleted" });
    }

    // A still-valid pending invitation works again after restore; one that
    // expired while the Workspace was deleted stays expired. Restore never
    // touches invitation rows, so this falls out of acceptInvitation's own
    // expiry check.
    {
      const workspaceId = await createWorkspace("SHARED", "Invite Co");
      const ownerId = await addMember(workspaceId, "OWNER");

      const liveInvitee = await createUser("Live Invitee");
      const liveToken = randomUUID();
      await prisma.workspaceInvitation.create({
        data: {
          id: randomUUID(),
          workspaceId,
          email: `workspace-restoration-${liveInvitee}@example.test`,
          role: "MEMBER",
          token: liveToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const expiredInvitee = await createUser("Expired Invitee");
      const expiredToken = randomUUID();
      await prisma.workspaceInvitation.create({
        data: {
          id: randomUUID(),
          workspaceId,
          email: `workspace-restoration-${expiredInvitee}@example.test`,
          role: "MEMBER",
          token: expiredToken,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await deleteWorkspace(prisma, workspaceId, ownerId);
      await restoreWorkspace(prisma, workspaceId, ownerId);

      const liveResult = await acceptInvitation(
        prisma,
        liveToken,
        liveInvitee,
        `workspace-restoration-${liveInvitee}@example.test`
      );
      assert.deepEqual(liveResult, { status: "accepted", workspaceId });

      const expiredResult = await acceptInvitation(
        prisma,
        expiredToken,
        expiredInvitee,
        `workspace-restoration-${expiredInvitee}@example.test`
      );
      assert.deepEqual(expiredResult, { status: "invalid" });
    }
  } finally {
    await prisma.workspaceInvitation.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.item.deleteMany({ where: { list: { workspaceId: { in: createdWorkspaceIds } } } });
    await prisma.list.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace restoration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
