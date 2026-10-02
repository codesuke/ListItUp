import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadWorkspaceNavData } from "./layout-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace layout smoke test skipped: DATABASE_URL is not set");
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

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: "Test User", email: `workspace-layout-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(
    kind: "SHARED" | "PERSONAL",
    name: string,
    memberUserId?: string,
    memberRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name,
        kind,
        members: memberUserId
          ? { create: [{ id: randomUUID(), userId: memberUserId, role: memberRole }] }
          : undefined,
      },
    });
    return workspaceId;
  }

  try {
    // A SHARED Workspace with a membership row appears in the switcher; a
    // SHARED Workspace with no membership row never does; and the User's
    // PERSONAL container is populated only into the Personal Space slot,
    // never the switcher — and vice versa.
    {
      const userId = await createUser();
      const memberSharedId = await createWorkspace("SHARED", "Acme Studio", userId);
      await createWorkspace("SHARED", "Outsider Co");
      const personalId = await createWorkspace("PERSONAL", "Personal Space", userId);

      const data = await loadWorkspaceNavData(prisma, userId, memberSharedId);

      assert.deepEqual(
        data.switchableWorkspaces.map((workspace) => workspace.id),
        [memberSharedId],
        "the switcher must list only SHARED Workspaces the User belongs to"
      );
      assert.ok(
        !data.switchableWorkspaces.some((workspace) => workspace.id === personalId),
        "the User's PERSONAL container must never appear in the switcher"
      );

      assert.ok(data.personalSpace, "expected a Personal Space for a member of one");
      assert.equal(data.personalSpace!.id, personalId);
      assert.notEqual(
        data.personalSpace!.id,
        memberSharedId,
        "a SHARED-kind container must never appear in the Personal Space slot"
      );
    }

    // A User with no PERSONAL container of their own gets a null Personal
    // Space slot rather than one borrowed from a SHARED Workspace.
    {
      const userId = await createUser();
      const sharedOnlyId = await createWorkspace("SHARED", "Shared Only Co", userId);

      const data = await loadWorkspaceNavData(prisma, userId, sharedOnlyId);

      assert.equal(data.personalSpace, null);
    }

    // The sidebar's Lists section (design-mocks/list-dashboard) shows the
    // current Workspace's visible Lists, not another Workspace's.
    {
      const userId = await createUser();
      const workspaceId = await createWorkspace("SHARED", "Acme Studio", userId);
      const otherWorkspaceId = await createWorkspace("SHARED", "Other Co", userId);
      const listId = randomUUID();
      createdListIds.push(listId);
      await prisma.list.create({
        data: {
          id: listId,
          workspaceId,
          name: "Platform Retrofit",
          members: { create: [{ id: randomUUID(), userId, role: "MEMBER" }] },
        },
      });
      const otherListId = randomUUID();
      createdListIds.push(otherListId);
      await prisma.list.create({ data: { id: otherListId, workspaceId: otherWorkspaceId, name: "Other List" } });

      const data = await loadWorkspaceNavData(prisma, userId, workspaceId);

      assert.deepEqual(data.lists, [{ id: listId, name: "Platform Retrofit" }]);
    }

    // The Settings nav entry (#58) is visible to the Owner/Admin of a
    // SHARED Workspace, never to a Member/Viewer, and never for a Personal
    // Space even for its sole Owner.
    {
      const ownerId = await createUser();
      const ownedWorkspaceId = await createWorkspace("SHARED", "Owner Co", ownerId, "OWNER");
      const ownerData = await loadWorkspaceNavData(prisma, ownerId, ownedWorkspaceId);
      assert.equal(ownerData.canManageWorkspaceSettings, true);

      const memberId = await createUser();
      const memberWorkspaceId = await createWorkspace("SHARED", "Member Co", memberId, "MEMBER");
      const memberData = await loadWorkspaceNavData(prisma, memberId, memberWorkspaceId);
      assert.equal(memberData.canManageWorkspaceSettings, false);

      const personalOwnerId = await createUser();
      const personalId = await createWorkspace(
        "PERSONAL",
        "Personal Space",
        personalOwnerId,
        "OWNER"
      );
      const personalData = await loadWorkspaceNavData(prisma, personalOwnerId, personalId);
      assert.equal(personalData.canManageWorkspaceSettings, false);
    }
  } finally {
    await prisma.listMember.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.list.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace layout smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
