import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadMyTasksPageData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("My Tasks page smoke test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `my-tasks-page-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithList(
    name: string,
    kind: "SHARED" | "PERSONAL" = "SHARED"
  ): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: `${name} List` } });
    return { workspaceId, listId };
  }

  async function joinWorkspace(workspaceId: string, listId: string, userId: string): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "MEMBER" } });
  }

  try {
    // filterWorkspaces lists every Workspace + Personal Space the User
    // belongs to, tagging which one is the Personal Space, regardless of
    // whether they currently have an assigned Item there (#42).
    {
      const userId = await createUser();
      const shared = await createWorkspaceWithList("Marketing");
      await joinWorkspace(shared.workspaceId, shared.listId, userId);
      const personal = await createWorkspaceWithList("Personal Space", "PERSONAL");
      await joinWorkspace(personal.workspaceId, personal.listId, userId);

      const item = await prisma.item.create({
        data: { id: randomUUID(), listId: shared.listId, creatorId: userId, title: "Campaign brief" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: item.id, userId } });

      const data = await loadMyTasksPageData(prisma, { userId });

      assert.equal(data.groups.length, 1, "the mock's smart sections (design-mocks/my-tasks) by default");
      assert.equal(data.groups[0].label, "No due date", "an undated Item lands in the No due date section");
      assert.equal(data.groups[0].items.length, 1);
      assert.equal(data.groups[0].items[0].title, "Campaign brief");
      assert.equal(data.selectedWorkspaceId, null);
      assert.equal(data.includeCompleted, false);
      assert.equal(data.includeArchived, false);

      const byId = new Map(data.filterWorkspaces.map((workspace) => [workspace.id, workspace]));
      assert.equal(byId.get(shared.workspaceId)?.isPersonal, false);
      assert.equal(byId.get(personal.workspaceId)?.isPersonal, true);
    }

    // Filtering by a specific source Workspace threads through to the
    // returned data and excludes Items from other sources.
    {
      const userId = await createUser();
      const workspaceA = await createWorkspaceWithList("Marketing");
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, userId);
      const workspaceB = await createWorkspaceWithList("Engineering");
      await joinWorkspace(workspaceB.workspaceId, workspaceB.listId, userId);

      const itemA = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceA.listId, creatorId: userId, title: "A task" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: itemA.id, userId } });
      const itemB = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceB.listId, creatorId: userId, title: "B task" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: itemB.id, userId } });

      const data = await loadMyTasksPageData(prisma, { userId, sourceWorkspaceId: workspaceA.workspaceId });

      assert.equal(data.selectedWorkspaceId, workspaceA.workspaceId);
      assert.deepEqual(data.groups[0].items.map((item) => item.title), ["A task"]);
    }

    // Search and Group threading (#44): a text query narrows the unified
    // set, and grouping arranges it without dropping or duplicating Items.
    {
      const userId = await createUser();
      const workspaceA = await createWorkspaceWithList("Marketing");
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, userId);
      const personal = await createWorkspaceWithList("Personal Space", "PERSONAL");
      await joinWorkspace(personal.workspaceId, personal.listId, userId);

      const matchItem = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceA.listId, creatorId: userId, title: "Fix platform signage" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: matchItem.id, userId } });
      const otherItem = await prisma.item.create({
        data: { id: randomUUID(), listId: personal.listId, creatorId: userId, title: "Buy groceries" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: otherItem.id, userId } });

      const searched = await loadMyTasksPageData(prisma, { userId, search: "signage" });
      assert.deepEqual(searched.groups[0].items.map((item) => item.title), ["Fix platform signage"]);
      assert.equal(searched.search, "signage");

      const grouped = await loadMyTasksPageData(prisma, { userId, groupBy: "WORKSPACE" });
      assert.equal(grouped.groupBy, "WORKSPACE");
      const totalGroupedItems = grouped.groups.reduce((sum, group) => sum + group.items.length, 0);
      assert.equal(totalGroupedItems, 2, "grouping must not drop or duplicate Items");
    }

    // Board/Calendar/Files (#43) all read the same effective-access Item
    // set as the List view, computed once in loadMyTasksPageData.
    {
      const userId = await createUser();
      const workspaceA = await createWorkspaceWithList("Marketing");
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, userId);
      const personal = await createWorkspaceWithList("Personal Space", "PERSONAL");
      await joinWorkspace(personal.workspaceId, personal.listId, userId);

      const highTodo = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId: workspaceA.listId,
          creatorId: userId,
          title: "High priority task",
          priority: "HIGH",
          dueDate: new Date("2026-09-20T00:00:00.000Z"),
        },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: highTodo.id, userId } });
      await prisma.attachment.create({
        data: {
          id: randomUUID(),
          itemId: highTodo.id,
          uploaderId: userId,
          fileName: "brief.pdf",
          contentType: "application/pdf",
          sizeBytes: 1024,
          storageKey: "key-1",
        },
      });

      const blockedPersonal = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId: personal.listId,
          creatorId: userId,
          title: "Blocked personal task",
          state: "BLOCKED",
          blockerReason: "Waiting on approval",
        },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: blockedPersonal.id, userId } });

      const undated = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceA.listId, creatorId: userId, title: "Undated task" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: undated.id, userId } });

      const now = new Date("2026-09-15T00:00:00.000Z");
      const data = await loadMyTasksPageData(prisma, { userId, now });

      // Board — default STATE grouping.
      const toDoColumn = data.boardColumns.find((column) => column.key === "TO_DO")!;
      assert.deepEqual(
        toDoColumn.items.map((item) => item.title).sort(),
        ["High priority task", "Undated task"]
      );
      const blockedColumn = data.boardColumns.find((column) => column.key === "BLOCKED")!;
      assert.deepEqual(blockedColumn.items.map((item) => item.title), ["Blocked personal task"]);

      // Board — grouping is driven by the boardGroupBy input, not persisted.
      const priorityData = await loadMyTasksPageData(prisma, { userId, now, boardGroupBy: "PRIORITY" });
      assert.equal(priorityData.boardGroupBy, "PRIORITY");
      const highColumn = priorityData.boardColumns.find((column) => column.key === "HIGH")!;
      assert.deepEqual(highColumn.items.map((item) => item.title), ["High priority task"]);

      // Calendar — the dated Item lands on its due-date cell; the undated
      // Item never appears in any cell.
      const septemberData = await loadMyTasksPageData(prisma, { userId, now, calendarMonth: "2026-09" });
      const sep20 = septemberData.calendarCells.find(
        (cell) => cell.date.toISOString().slice(0, 10) === "2026-09-20"
      )!;
      assert.deepEqual(sep20.items.map((item) => item.title), ["High priority task"]);
      const allCalendarTitles = septemberData.calendarCells.flatMap((cell) => cell.items.map((item) => item.title));
      assert.equal(allCalendarTitles.includes("Undated task"), false);

      // Files — only the Item carrying an Attachment appears, tagged with
      // its source Workspace.
      assert.equal(data.fileEntries.length, 1);
      assert.equal(data.fileEntries[0].fileName, "brief.pdf");
      assert.equal(data.fileEntries[0].sourceWorkspaceName, "Marketing");

      // Dashboard (#52) — counts/breakdowns computed from the same
      // effective-access Item set as List/Board/Calendar/Files above.
      assert.deepEqual(data.dashboard.counts, { total: 3, completed: 0, incomplete: 3, overdue: 0 });
      assert.deepEqual(
        data.dashboard.byState.map((entry) => [entry.label, entry.count]),
        [
          ["To Do", 2],
          ["In Progress", 0],
          ["Blocked", 1],
          ["Complete", 0],
        ]
      );
      assert.deepEqual(
        data.dashboard.byWorkspace.map((entry) => [entry.label, entry.count]),
        [
          ["Marketing", 2],
          ["Personal Space", 1],
        ]
      );
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("My Tasks page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
