import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createReport } from "./report-crud";
import { exportReportCsv } from "./report-csv-export";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("report csv export integration test skipped: DATABASE_URL is not set");
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
    await prisma.user.create({ data: { id: userId, name, email: `report-csv-${userId}@example.test` } });
    return userId;
  }

  async function createWorkspaceAndList(): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    return { workspaceId, listId };
  }

  async function addMember(workspaceId: string, listId: string): Promise<string> {
    const userId = await createUser("Member");
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "MEMBER" } });
    return userId;
  }

  async function createItem(listId: string, creatorId: string, title: string, state: "TO_DO" | "BLOCKED" | "COMPLETE") {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, creatorId, title, state } });
    return itemId;
  }

  try {
    // The CSV only contains Items matching the Report's filter, not every
    // Item on the List (ADR 0012's filter-aware export addendum).
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId);
      await createItem(listId, creatorId, "Blocked thing", "BLOCKED");
      await createItem(listId, creatorId, "To-do thing", "TO_DO");

      const createResult = await createReport(prisma, {
        actorUserId: creatorId,
        listId,
        name: "Blocked work",
        filter: { states: ["BLOCKED"] },
      });
      assert.equal(createResult.status, "created");
      const reportId = createResult.status === "created" ? createResult.reportId : "";

      const first = await exportReportCsv(prisma, {
        actorUserId: creatorId,
        reportId,
        now: new Date("2026-10-09T00:00:00.000Z"),
      });
      assert.equal(first.status, "ok");
      if (first.status === "ok") {
        assert.ok(first.body.includes("Blocked thing"));
        assert.ok(!first.body.includes("To-do thing"));
        assert.equal(first.filename, "blocked-work-2026-10-09.csv");
      }

      // Live re-run: resolving the Blocked Item drops it from the next export.
      await prisma.item.updateMany({ where: { listId, title: "Blocked thing" }, data: { state: "COMPLETE" } });
      const second = await exportReportCsv(prisma, { actorUserId: creatorId, reportId });
      assert.equal(second.status, "ok");
      if (second.status === "ok") {
        assert.ok(!second.body.includes("Blocked thing"));
      }
    }

    // Only the Report's creator may export it.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId);
      const otherMemberId = await addMember(workspaceId, listId);

      const createResult = await createReport(prisma, {
        actorUserId: creatorId,
        listId,
        name: "Private export",
        filter: {},
      });
      assert.equal(createResult.status, "created");
      const reportId = createResult.status === "created" ? createResult.reportId : "";

      assert.deepEqual(await exportReportCsv(prisma, { actorUserId: otherMemberId, reportId }), {
        status: "not-found",
      });
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.report.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.itemAssignee.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.item.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("report csv export integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
