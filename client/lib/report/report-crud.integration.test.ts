import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createReport, deleteReport, getReport, listReportsForUser, renameReport, runReport } from "./report-crud";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("report crud integration test skipped: DATABASE_URL is not set");
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
    await prisma.user.create({ data: { id: userId, name, email: `report-crud-${userId}@example.test` } });
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

  async function addMember(
    workspaceId: string,
    listId: string,
    listRole: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<string> {
    const userId = await createUser(`Member-${listRole}`);
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: listRole } });
    return userId;
  }

  async function createItem(listId: string, creatorId: string, overrides: { title?: string; state?: "TO_DO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" } = {}) {
    const itemId = randomUUID();
    await prisma.item.create({
      data: { id: itemId, listId, creatorId, title: overrides.title ?? "Item", state: overrides.state ?? "TO_DO" },
    });
    return itemId;
  }

  try {
    // A List Member can save their current filter setup as a named Report,
    // and opening it returns the Report's own name/filter.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId, "MEMBER");

      const createResult = await createReport(prisma, {
        actorUserId: creatorId,
        listId,
        name: "My blocked items",
        filter: { states: ["BLOCKED"] },
      });
      assert.equal(createResult.status, "created");
      const reportId = createResult.status === "created" ? createResult.reportId : "";

      const fetched = await getReport(prisma, { actorUserId: creatorId, reportId });
      assert.deepEqual(fetched?.filter, { states: ["BLOCKED"] });
      assert.equal(fetched?.name, "My blocked items");
    }

    // A List Viewer (no write access) can still save and run a Report — no
    // creation gate beyond ordinary read access.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const viewerId = await addMember(workspaceId, listId, "VIEWER");

      const createResult = await createReport(prisma, {
        actorUserId: viewerId,
        listId,
        name: "Viewer's report",
        filter: {},
      });
      assert.equal(createResult.status, "created");
    }

    // A List Member who didn't create a Report cannot see it via
    // listReportsForUser, and cannot rename or delete it — both resolve as
    // not-found rather than leaking that the Report exists.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId, "MEMBER");
      const otherMemberId = await addMember(workspaceId, listId, "MEMBER");

      const createResult = await createReport(prisma, {
        actorUserId: creatorId,
        listId,
        name: "Private to me",
        filter: {},
      });
      assert.equal(createResult.status, "created");
      const reportId = createResult.status === "created" ? createResult.reportId : "";

      const othersView = await listReportsForUser(prisma, { actorUserId: otherMemberId, listId });
      assert.deepEqual(othersView, []);

      const ownersView = await listReportsForUser(prisma, { actorUserId: creatorId, listId });
      assert.equal(ownersView.length, 1);
      assert.equal(ownersView[0].id, reportId);

      assert.deepEqual(await renameReport(prisma, { actorUserId: otherMemberId, reportId, name: "Hijacked" }), {
        status: "not-found",
      });
      assert.deepEqual(await deleteReport(prisma, { actorUserId: otherMemberId, reportId }), {
        status: "not-found",
      });
      assert.equal(await getReport(prisma, { actorUserId: otherMemberId, reportId }), null);

      // The creator still can.
      assert.deepEqual(await renameReport(prisma, { actorUserId: creatorId, reportId, name: "Renamed" }), {
        status: "renamed",
      });
      const renamed = await getReport(prisma, { actorUserId: creatorId, reportId });
      assert.equal(renamed?.name, "Renamed");

      assert.deepEqual(await deleteReport(prisma, { actorUserId: creatorId, reportId }), { status: "deleted" });
      assert.equal(await getReport(prisma, { actorUserId: creatorId, reportId }), null);
    }

    // Reopening a saved Report re-runs its filter against current Item
    // data live — never a frozen snapshot of what matched at save time.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId, "MEMBER");

      const matchingItemId = await createItem(listId, creatorId, { title: "Blocked thing", state: "BLOCKED" });
      await createItem(listId, creatorId, { title: "Unrelated thing", state: "TO_DO" });

      const createResult = await createReport(prisma, {
        actorUserId: creatorId,
        listId,
        name: "Blocked work",
        filter: { states: ["BLOCKED"] },
      });
      assert.equal(createResult.status, "created");
      const reportId = createResult.status === "created" ? createResult.reportId : "";

      const firstRun = await runReport(prisma, { actorUserId: creatorId, reportId });
      assert.equal(firstRun.status, "ok");
      assert.deepEqual(
        firstRun.status === "ok" ? firstRun.items.map((item) => item.id) : [],
        [matchingItemId]
      );

      // Change the underlying data between runs: resolve the Blocked Item
      // and add a fresh one that now matches instead.
      await prisma.item.update({ where: { id: matchingItemId }, data: { state: "COMPLETE" } });
      const newlyBlockedId = await createItem(listId, creatorId, { title: "New blocker", state: "BLOCKED" });

      const secondRun = await runReport(prisma, { actorUserId: creatorId, reportId });
      assert.equal(secondRun.status, "ok");
      assert.deepEqual(
        secondRun.status === "ok" ? secondRun.items.map((item) => item.id) : [],
        [newlyBlockedId]
      );
    }

    // A Report's creator losing List access can no longer read or run it.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId, "MEMBER");

      const createResult = await createReport(prisma, {
        actorUserId: creatorId,
        listId,
        name: "Soon inaccessible",
        filter: {},
      });
      assert.equal(createResult.status, "created");
      const reportId = createResult.status === "created" ? createResult.reportId : "";

      await prisma.listMember.delete({ where: { listId_userId: { listId, userId: creatorId } } });
      await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: creatorId } } });

      assert.equal(await getReport(prisma, { actorUserId: creatorId, reportId }), null);
      assert.deepEqual(await runReport(prisma, { actorUserId: creatorId, reportId }), { status: "not-found" });
    }

    // Invalid name/filter shapes are rejected before anything is persisted.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const creatorId = await addMember(workspaceId, listId, "MEMBER");

      assert.deepEqual(
        await createReport(prisma, { actorUserId: creatorId, listId, name: "   ", filter: {} }),
        { status: "invalid-name", reason: "Report name cannot be empty." }
      );
      assert.deepEqual(
        await createReport(prisma, { actorUserId: creatorId, listId, name: "Valid", filter: { states: ["NOPE"] } }),
        { status: "invalid-filter", reason: "states must be an array of valid Item states." }
      );
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

  console.log("report crud integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
