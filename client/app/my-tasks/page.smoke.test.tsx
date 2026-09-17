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

      // Dashboard (#46) — counts/breakdowns computed from the same
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
        data.dashboard.byList.map((entry) => [entry.label, entry.count]),
        [
          ["Marketing List", 2],
          ["Personal Space List", 1],
        ]
      );
      assert.equal(data.dashboard.completionOverTime.length, 14, "the same 14-day window as List Dashboard");
      assert.ok(
        data.dashboard.completionOverTime.every((point) => point.cumulativeCompleted === 0),
        "no Complete Items in this fixture"
      );
      // Progress graph (#49) — same computeProgressPercent as List
      // Dashboard, applied to the User's cross-Workspace assigned set.
      assert.equal(data.dashboard.progressPercent, 0);
    }

    // Contribution Map (#50) — personal-only, broken down per source List
    // rather than per Member, using a normalized completion rate rather
    // than raw counts. Called with no includeCompleted flag (the List/
    // Board/Calendar/Files default) to prove the Dashboard's own metrics
    // always see Complete Items regardless of that toggle.
    {
      const userId = await createUser();
      const workspaceA = await createWorkspaceWithList("Marketing");
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, userId);
      const workspaceB = await createWorkspaceWithList("Engineering");
      await joinWorkspace(workspaceB.workspaceId, workspaceB.listId, userId);

      const doneInA = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceA.listId, creatorId: userId, title: "Shipped A", state: "COMPLETE" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: doneInA.id, userId } });
      const pendingInA = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceA.listId, creatorId: userId, title: "Pending A" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: pendingInA.id, userId } });

      const doneInB = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceB.listId, creatorId: userId, title: "Shipped B", state: "COMPLETE" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: doneInB.id, userId } });

      // A second User with their own Item in the same List — never
      // assigned to the first User, so must never affect their rates.
      const otherUserId = await createUser();
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, otherUserId);
      const otherPendingInA = await prisma.item.create({
        data: { id: randomUUID(), listId: workspaceA.listId, creatorId: otherUserId, title: "Other's pending A" },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: otherPendingInA.id, userId: otherUserId } });

      const data = await loadMyTasksPageData(prisma, { userId });

      assert.deepEqual(data.dashboard.contributionByList, [
        { listId: workspaceB.listId, label: "Engineering List", completionRatePercent: 100 },
        { listId: workspaceA.listId, label: "Marketing List", completionRatePercent: 50 },
      ]);
    }

    // Attention Imbalance radar (#51) — personal-only, normalized against
    // the User's own busiest axis rather than a busiest-Member comparison.
    {
      const userId = await createUser();
      const workspaceA = await createWorkspaceWithList("Marketing");
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, userId);

      for (let i = 0; i < 3; i++) {
        const toDo = await prisma.item.create({
          data: { id: randomUUID(), listId: workspaceA.listId, creatorId: userId, title: `To Do ${i}` },
        });
        await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: toDo.id, userId } });
      }
      const blocked = await prisma.item.create({
        data: {
          id: randomUUID(),
          listId: workspaceA.listId,
          creatorId: userId,
          title: "Blocked task",
          state: "BLOCKED",
          blockerReason: "Waiting on review",
        },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: blocked.id, userId } });

      // A second User with 5 Blocked Items of their own in the same List —
      // never assigned to the first User, so must never affect their shape.
      // If this leaked in, Blocked would wrongly become the busiest axis.
      const otherUserId = await createUser();
      await joinWorkspace(workspaceA.workspaceId, workspaceA.listId, otherUserId);
      for (let i = 0; i < 5; i++) {
        const otherBlocked = await prisma.item.create({
          data: {
            id: randomUUID(),
            listId: workspaceA.listId,
            creatorId: otherUserId,
            title: `Other's blocked ${i}`,
            state: "BLOCKED",
            blockerReason: "Waiting on review",
          },
        });
        await prisma.itemAssignee.create({
          data: { id: randomUUID(), itemId: otherBlocked.id, userId: otherUserId },
        });
      }

      const data = await loadMyTasksPageData(prisma, { userId });

      // 3 raw To Do Items is the User's own busiest axis, so it reaches 1;
      // the 1 raw Blocked Item normalizes to 1/3 — unaffected by the other
      // User's 5 Blocked Items in the same List.
      assert.deepEqual(data.dashboard.attentionImbalance, { TO_DO: 1, BLOCKED: 1 / 3, OVERDUE: 0, DONE: 0 });
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
