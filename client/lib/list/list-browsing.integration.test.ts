import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { browseLists } from "./list-browsing";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list browsing integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `list-browsing-${userId}@example.test` },
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
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  async function createList(
    workspaceId: string,
    overrides: Partial<{ name: string; status: "ON_TRACK" | "ON_HOLD" | "COMPLETED" | "DROPPED"; archivedAt: Date }> = {}
  ): Promise<string> {
    const listId = randomUUID();
    await prisma.list.create({
      data: { id: listId, workspaceId, name: overrides.name ?? "Test List", status: overrides.status, archivedAt: overrides.archivedAt },
    });
    return listId;
  }

  async function addListMember(listId: string, userId: string, role: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER") {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
  }

  try {
    // A Workspace Owner sees every List, including ones with no explicit
    // ListMember row.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const listA = await createList(workspaceId, { name: "Alpha" });
      const listB = await createList(workspaceId, { name: "Beta" });

      const results = await browseLists(prisma, { userId: ownerId, workspaceId });
      const ids = results.map((r) => r.id).sort();
      assert.deepEqual(ids, [listA, listB].sort());
    }

    // A Workspace Admin with no explicit List row sees nothing — Admins
    // have no implicit List access (ADR 0016).
    {
      const workspaceId = await createWorkspace();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      await createList(workspaceId, { name: "Not Admin's" });

      const results = await browseLists(prisma, { userId: adminId, workspaceId });
      assert.deepEqual(results, []);
    }

    // A Workspace Member only sees Lists they're explicitly a Member of.
    {
      const workspaceId = await createWorkspace();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      const visibleList = await createList(workspaceId, { name: "Visible" });
      await addListMember(visibleList, memberId);
      await createList(workspaceId, { name: "Hidden" });

      const results = await browseLists(prisma, { userId: memberId, workspaceId });
      assert.deepEqual(results.map((r) => r.id), [visibleList]);
    }

    // Search filters by name (case-insensitive substring).
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const retrofit = await createList(workspaceId, { name: "Platform Retrofit" });
      await createList(workspaceId, { name: "Vendor Onboarding" });

      const results = await browseLists(prisma, { userId: ownerId, workspaceId, search: "retrofit" });
      assert.deepEqual(results.map((r) => r.id), [retrofit]);
    }

    // Status filter narrows results.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const onHold = await createList(workspaceId, { name: "Held", status: "ON_HOLD" });
      await createList(workspaceId, { name: "Tracking", status: "ON_TRACK" });

      const results = await browseLists(prisma, { userId: ownerId, workspaceId, status: "ON_HOLD" });
      assert.deepEqual(results.map((r) => r.id), [onHold]);
    }

    // Starred filter only returns the viewer's own starred Lists.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const starred = await createList(workspaceId, { name: "Starred" });
      await createList(workspaceId, { name: "Not starred" });
      await prisma.starred.create({ data: { id: randomUUID(), userId: ownerId, listId: starred } });

      const results = await browseLists(prisma, { userId: ownerId, workspaceId, starredOnly: true });
      assert.deepEqual(results.map((r) => r.id), [starred]);
      assert.equal(results[0].isStarredByViewer, true);
    }

    // The Archived tab shows only archived Lists; the default view excludes
    // them.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const archived = await createList(workspaceId, { name: "Archived", archivedAt: new Date() });
      const active = await createList(workspaceId, { name: "Active" });

      const defaultView = await browseLists(prisma, { userId: ownerId, workspaceId });
      assert.deepEqual(defaultView.map((r) => r.id), [active]);

      const archivedTab = await browseLists(prisma, { userId: ownerId, workspaceId, archived: true });
      assert.deepEqual(archivedTab.map((r) => r.id), [archived]);
    }

    // Members filter narrows to Lists a specific User belongs to.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      const otherMemberId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      await addWorkspaceMember(workspaceId, otherMemberId, "MEMBER");
      const shared = await createList(workspaceId, { name: "Shared" });
      await addListMember(shared, otherMemberId);
      await createList(workspaceId, { name: "Solo" });

      const results = await browseLists(prisma, {
        userId: ownerId,
        workspaceId,
        memberUserId: otherMemberId,
      });
      assert.deepEqual(results.map((r) => r.id), [shared]);
    }

    // A Deleted Workspace returns no Lists, for an Owner or a List Member
    // alike (#76).
    {
      const workspaceId = await createWorkspace();
      const ownerId = await createUser();
      await addWorkspaceMember(workspaceId, ownerId, "OWNER");
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      const memberList = await createList(workspaceId, { name: "Member List" });
      await addListMember(memberList, memberId);

      await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });

      assert.deepEqual(await browseLists(prisma, { userId: ownerId, workspaceId }), []);
      assert.deepEqual(await browseLists(prisma, { userId: memberId, workspaceId }), []);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.starred.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list browsing integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
