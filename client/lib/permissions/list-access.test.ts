import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { canExportList, resolveListAccess } from "./list-access";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list access test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `list-access-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    return workspaceId;
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });
  }

  async function createListIn(workspaceId: string): Promise<string> {
    const listId = randomUUID();
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    return listId;
  }

  async function addListMember(
    listId: string,
    userId: string,
    role: "LEAD" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
  }

  async function addGuest(listId: string, userId: string): Promise<void> {
    await prisma.guest.create({ data: { id: randomUUID(), listId, userId } });
  }

  try {
    // Workspace Owner: implicit ADMIN access, no explicit List role needed.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "OWNER");
      const listId = await createListIn(workspaceId);

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "ADMIN");
    }

    // Workspace Admin: implicit ADMIN access, no explicit List role needed.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "ADMIN");
      const listId = await createListIn(workspaceId);

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "ADMIN");
    }

    // Workspace Member with no List role: NONE — Lists are private by default.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "MEMBER");
      const listId = await createListIn(workspaceId);

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "NONE");
    }

    // Workspace Member + List LEAD -> LEAD.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "MEMBER");
      const listId = await createListIn(workspaceId);
      await addListMember(listId, userId, "LEAD");

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "LEAD");
    }

    // Workspace Member + List MEMBER -> WRITE.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "MEMBER");
      const listId = await createListIn(workspaceId);
      await addListMember(listId, userId, "MEMBER");

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "WRITE");
    }

    // Workspace Member + List VIEWER -> READ.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "MEMBER");
      const listId = await createListIn(workspaceId);
      await addListMember(listId, userId, "VIEWER");

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "READ");
    }

    // Workspace Viewer + List LEAD -> READ. The Viewer ceiling holds no
    // matter what List-level role is granted.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "VIEWER");
      const listId = await createListIn(workspaceId);
      await addListMember(listId, userId, "LEAD");

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "READ");
    }

    // Workspace Viewer + List MEMBER -> READ (ceiling holds).
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "VIEWER");
      const listId = await createListIn(workspaceId);
      await addListMember(listId, userId, "MEMBER");

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "READ");
    }

    // Workspace Viewer + List VIEWER -> READ.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceId, userId, "VIEWER");
      const listId = await createListIn(workspaceId);
      await addListMember(listId, userId, "VIEWER");

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "READ");
    }

    // Guest with a matching grant: READ, with no Workspace membership at all.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      const listId = await createListIn(workspaceId);
      await addGuest(listId, userId);

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "READ");
    }

    // Guest without a matching grant: NONE.
    {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      const listId = await createListIn(workspaceId);

      assert.equal(await resolveListAccess(prisma, { userId, listId }), "NONE");
    }

    // User with no relationship to the Workspace or List at all: NONE.
    {
      const workspaceId = await createWorkspace();
      const listId = await createListIn(workspaceId);
      const strangerId = await createUser();

      assert.equal(await resolveListAccess(prisma, { userId: strangerId, listId }), "NONE");
    }

    // canExportList (#72): anyone who can read the List may export it —
    // including the Viewer roles — except a Guest, who is external and
    // holds no Workspace or List role. Everyone else is refused.
    {
      const workspaceId = await createWorkspace();
      const listId = await createListIn(workspaceId);

      const owner = await createUser();
      await addWorkspaceMember(workspaceId, owner, "OWNER");
      const admin = await createUser();
      await addWorkspaceMember(workspaceId, admin, "ADMIN");
      const lead = await createUser();
      await addWorkspaceMember(workspaceId, lead, "MEMBER");
      await addListMember(listId, lead, "LEAD");
      const member = await createUser();
      await addWorkspaceMember(workspaceId, member, "MEMBER");
      await addListMember(listId, member, "MEMBER");
      const listViewer = await createUser();
      await addWorkspaceMember(workspaceId, listViewer, "MEMBER");
      await addListMember(listId, listViewer, "VIEWER");
      const workspaceViewer = await createUser();
      await addWorkspaceMember(workspaceId, workspaceViewer, "VIEWER");
      await addListMember(listId, workspaceViewer, "MEMBER");
      for (const userId of [owner, admin, lead, member, listViewer, workspaceViewer]) {
        assert.equal(await canExportList(prisma, { userId, listId }), true, `expected ${userId} to export`);
      }

      const guest = await createUser();
      await addGuest(listId, guest);
      const unassignedMember = await createUser();
      await addWorkspaceMember(workspaceId, unassignedMember, "MEMBER");
      const stranger = await createUser();
      for (const userId of [guest, unassignedMember, stranger]) {
        assert.equal(await canExportList(prisma, { userId, listId }), false, `expected ${userId} to be refused`);
      }
      assert.equal(await canExportList(prisma, { userId: owner, listId: randomUUID() }), false);
    }

    // Multi-Workspace: a User who is a Member of List A's Workspace but has
    // no relationship to List B's Workspace gets no access to List B.
    {
      const workspaceAId = await createWorkspace();
      const workspaceBId = await createWorkspace();
      const userId = await createUser();
      await addWorkspaceMember(workspaceAId, userId, "OWNER");
      const listAId = await createListIn(workspaceAId);
      const listBId = await createListIn(workspaceBId);

      assert.equal(await resolveListAccess(prisma, { userId, listId: listAId }), "ADMIN");
      assert.equal(await resolveListAccess(prisma, { userId, listId: listBId }), "NONE");
    }

    // A non-existent List resolves to NONE rather than throwing.
    {
      assert.equal(
        await resolveListAccess(prisma, { userId: await createUser(), listId: randomUUID() }),
        "NONE"
      );
    }

    // A Deleted Workspace's List resolves to NONE for everyone — Owner,
    // Guest, and export — regardless of role (#76).
    {
      const workspaceId = await createWorkspace();
      const listId = await createListIn(workspaceId);
      const owner = await createUser();
      await addWorkspaceMember(workspaceId, owner, "OWNER");
      const guest = await createUser();
      await addGuest(listId, guest);

      await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });

      assert.equal(await resolveListAccess(prisma, { userId: owner, listId }), "NONE");
      assert.equal(await resolveListAccess(prisma, { userId: guest, listId }), "NONE");
      assert.equal(await canExportList(prisma, { userId: owner, listId }), false);
    }
  } finally {
    await prisma.guest.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.listMember.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.list.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list access test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
