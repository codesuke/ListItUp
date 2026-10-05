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

  // Cascades from the Workspace delete in `finally` clean up the List and
  // its ListMember rows, so callers don't need to track list IDs separately.
  async function addList(
    workspaceId: string,
    members: Array<{ userId: string; role: "LEAD" | "MEMBER" | "VIEWER" }>
  ): Promise<string> {
    const listId = randomUUID();
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Checklist" } });
    for (const { userId, role } of members) {
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
    }
    return listId;
  }

  async function listRoleOf(listId: string, userId: string): Promise<string | undefined> {
    const membership = await prisma.listMember.findUnique({
      where: { listId_userId: { listId, userId } },
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

    // Demoting a Member to Viewer is blocked while they are the sole Lead of
    // any List, and the block reports the blocking count (#99).
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const memberId = await addMember(workspaceId, "MEMBER");
      const soleLeadListId = await addList(workspaceId, [{ userId: memberId, role: "LEAD" }]);
      const coLeadListId = await addList(workspaceId, [
        { userId: memberId, role: "LEAD" },
        { userId: ownerId, role: "LEAD" },
      ]);

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: ownerId,
        targetUserId: memberId,
        role: "VIEWER",
      });

      assert.deepEqual(result, { status: "sole-lead-block", count: 1 });
      assert.equal(await roleOf(workspaceId, memberId), "MEMBER");
      assert.equal(await listRoleOf(soleLeadListId, memberId), "LEAD");
      assert.equal(await listRoleOf(coLeadListId, memberId), "LEAD");
    }

    // A non-blocking demotion to Viewer converts the Member's List LEAD and
    // MEMBER rows to VIEWER in the same operation, atomically (#99).
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const memberId = await addMember(workspaceId, "MEMBER");
      const coLeadListId = await addList(workspaceId, [
        { userId: memberId, role: "LEAD" },
        { userId: ownerId, role: "LEAD" },
      ]);
      const plainMemberListId = await addList(workspaceId, [{ userId: memberId, role: "MEMBER" }]);
      const alreadyViewerListId = await addList(workspaceId, [{ userId: memberId, role: "VIEWER" }]);

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: ownerId,
        targetUserId: memberId,
        role: "VIEWER",
      });

      assert.deepEqual(result, { status: "updated" });
      assert.equal(await roleOf(workspaceId, memberId), "VIEWER");
      assert.equal(await listRoleOf(coLeadListId, memberId), "VIEWER");
      assert.equal(await listRoleOf(plainMemberListId, memberId), "VIEWER");
      assert.equal(await listRoleOf(alreadyViewerListId, memberId), "VIEWER");
    }

    // Sole-Lead status is counted per List: being the sole Lead of two Lists
    // reports a count of two.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const memberId = await addMember(workspaceId, "MEMBER");
      await addList(workspaceId, [{ userId: memberId, role: "LEAD" }]);
      await addList(workspaceId, [{ userId: memberId, role: "LEAD" }]);

      const result = await updateWorkspaceMemberRole(prisma, {
        workspaceId,
        actingUserId: ownerId,
        targetUserId: memberId,
        role: "VIEWER",
      });

      assert.deepEqual(result, { status: "sole-lead-block", count: 2 });
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
