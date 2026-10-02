import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadHomePageData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("Home page smoke test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `home-page-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(name: string): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind: "SHARED" } });
    return workspaceId;
  }

  async function joinWorkspace(workspaceId: string, userId: string): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
  }

  try {
    // A non-member gets null (mirrors the List browsing / My Tasks page-data
    // membership gate) rather than any widget data.
    {
      const userId = await createUser();
      const workspaceId = await createWorkspace("No Access");
      const data = await loadHomePageData(prisma, { userId, workspaceId });
      assert.equal(data, null);
    }

    // Each widget is scoped to the current Workspace, and Lists the User
    // has no access to (private, no membership row) never appear in Recent
    // Lists.
    {
      const userId = await createUser();
      const delegate = await createUser();
      const workspaceId = await createWorkspace("Marketing");
      const otherWorkspaceId = await createWorkspace("Engineering");
      await joinWorkspace(workspaceId, userId);
      await joinWorkspace(otherWorkspaceId, userId);

      const visibleListId = randomUUID();
      await prisma.list.create({ data: { id: visibleListId, workspaceId, name: "Campaigns" } });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId: visibleListId, userId, role: "MEMBER" },
      });

      const privateListId = randomUUID();
      await prisma.list.create({ data: { id: privateListId, workspaceId, name: "Private Roadmap" } });

      const otherWorkspaceListId = randomUUID();
      await prisma.list.create({
        data: { id: otherWorkspaceListId, workspaceId: otherWorkspaceId, name: "Eng List" },
      });
      await prisma.listMember.create({
        data: { id: randomUUID(), listId: otherWorkspaceListId, userId, role: "MEMBER" },
      });

      const myTaskItem = await prisma.item.create({
        data: { id: randomUUID(), listId: visibleListId, creatorId: delegate, title: "Assigned to me" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: myTaskItem.id, userId } });

      const otherWorkspaceTaskItem = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId: otherWorkspaceListId,
          creatorId: delegate,
          title: "Assigned to me elsewhere",
        },
      });
      await prisma.itemAssignee.create({
        data: { id: randomUUID(), itemId: otherWorkspaceTaskItem.id, userId },
      });

      const delegatedItem = await prisma.item.create({
        data: { id: randomUUID(), listId: visibleListId, creatorId: userId, title: "Delegated to teammate" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: delegatedItem.id, userId: delegate } });

      const data = await loadHomePageData(prisma, { userId, workspaceId });

      assert.ok(data);
      assert.equal(data!.workspaceName, "Marketing");

      const myTasksTitles = data!.myTasksSections.flatMap((section) => section.items.map((item) => item.title));
      assert.deepEqual(myTasksTitles, ["Assigned to me"]);
      assert.equal(data!.myTasksTotalCount, 1);

      const listNames = data!.recentLists.map((list) => list.name).sort();
      assert.deepEqual(listNames, ["Campaigns"]);

      assert.deepEqual(data!.assignedByMe.map((item) => item.title), ["Delegated to teammate"]);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("Home page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
