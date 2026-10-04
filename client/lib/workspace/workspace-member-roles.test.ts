import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { updateWorkspaceMemberRole } from "./workspace-member-roles";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace member roles test skipped: DATABASE_URL is not set");
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

  async function createWorkspaceWithOwner(): Promise<{
    workspaceId: string;
    ownerId: string;
  }> {
    const workspaceId = randomUUID();
    const ownerId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    createdUserIds.push(ownerId);

    await prisma.user.create({
      data: { id: ownerId, name: "Owner", email: `owner-${randomUUID()}@example.test` },
    });
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team" } });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
    });

    return { workspaceId, ownerId };
  }

  async function addMember(
    workspaceId: string,
    role: "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: "Member", email: `member-${randomUUID()}@example.test` },
    });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });

    return userId;
  }

  async function roleOf(workspaceId: string, userId: string): Promise<string | undefined> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return membership?.role;
  }

  try {
    // An Owner can promote an existing Member to Admin.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const memberId = await addMember(workspaceId, "MEMBER");

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: ownerId,
        targetUserId: memberId,
        role: "ADMIN",
      });

      assert.deepEqual(result, { status: "updated" });
      assert.equal(await roleOf(workspaceId, memberId), "ADMIN");
    }

    // An Admin can demote another Admin back to Member.
    {
      const { workspaceId } = await createWorkspaceWithOwner();
      const actingAdminId = await addMember(workspaceId, "ADMIN");
      const targetAdminId = await addMember(workspaceId, "ADMIN");

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: actingAdminId,
        targetUserId: targetAdminId,
        role: "MEMBER",
      });

      assert.deepEqual(result, { status: "updated" });
      assert.equal(await roleOf(workspaceId, targetAdminId), "MEMBER");
    }

    // A Member cannot change anyone's role.
    {
      const { workspaceId } = await createWorkspaceWithOwner();
      const actingMemberId = await addMember(workspaceId, "MEMBER");
      const targetId = await addMember(workspaceId, "VIEWER");

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: actingMemberId,
        targetUserId: targetId,
        role: "ADMIN",
      });

      assert.deepEqual(result, { status: "forbidden" });
      assert.equal(await roleOf(workspaceId, targetId), "VIEWER");
    }

    // The Owner's role cannot be changed through this path.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const adminId = await addMember(workspaceId, "ADMIN");

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: adminId,
        targetUserId: ownerId,
        role: "MEMBER",
      });

      assert.deepEqual(result, { status: "cannot-change-owner" });
      assert.equal(await roleOf(workspaceId, ownerId), "OWNER");
    }

    // OWNER is rejected as a target role (promotion only happens via
    // ownership transfer).
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const memberId = await addMember(workspaceId, "MEMBER");

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: ownerId,
        targetUserId: memberId,
        role: "OWNER",
      });

      assert.deepEqual(result, { status: "invalid-role" });
      assert.equal(await roleOf(workspaceId, memberId), "MEMBER");
    }

    // A target who isn't a member of this Workspace is reported distinctly.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const outsiderId = randomUUID();
      createdUserIds.push(outsiderId);
      await prisma.user.create({
        data: {
          id: outsiderId,
          name: "Outsider",
          email: `outsider-${randomUUID()}@example.test`,
        },
      });

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: ownerId,
        targetUserId: outsiderId,
        role: "ADMIN",
      });

      assert.deepEqual(result, { status: "not-found" });
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace member roles test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
