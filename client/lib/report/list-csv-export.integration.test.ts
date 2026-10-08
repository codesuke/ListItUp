import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { exportListCsv } from "./list-csv-export";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list csv export integration test skipped: DATABASE_URL is not set");
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
    await prisma.user.create({ data: { id: userId, name, email: `list-export-${userId}@example.test` } });
    return userId;
  }

  async function createWorkspaceAndList(listName = "Platform Retrofit") {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: listName } });
    return { workspaceId, listId };
  }

  async function addWorkspaceMember(workspaceId: string, userId: string, role: "MEMBER" | "VIEWER") {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  const NOW = new Date("2026-10-02T12:00:00.000Z");

  try {
    // A List Member's export contains every Item (Archived included) with
    // its Section, Assignees, Labels, and Custom Field values, and carries
    // neither Notes nor Personal Notes.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const memberId = await createUser("Ada");
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });

      const sectionId = randomUUID();
      await prisma.section.create({ data: { id: sectionId, listId, name: "Planning", order: 0 } });
      const labelId = randomUUID();
      await prisma.label.create({ data: { id: labelId, workspaceId, name: "urgent" } });
      const fieldId = randomUUID();
      await prisma.customFieldDefinition.create({
        data: { id: fieldId, listId, name: "Owner", type: "TEXT" },
      });

      const activeItemId = randomUUID();
      const archivedItemId = randomUUID();
      await prisma.item.create({
        data: { id: activeItemId, listId, sectionId, title: "Write spec", creatorId: memberId, priority: "HIGH" },
      });
      await prisma.item.create({
        data: {
          id: archivedItemId,
          listId,
          title: "Old idea",
          creatorId: memberId,
          state: "ARCHIVED",
          createdAt: new Date("2026-10-02T13:00:00.000Z"),
        },
      });
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId: activeItemId, userId: memberId } });
      await prisma.itemLabel.create({ data: { id: randomUUID(), itemId: activeItemId, labelId } });
      await prisma.customFieldValue.create({
        data: { id: randomUUID(), itemId: activeItemId, definitionId: fieldId, value: "Platform" },
      });
      await prisma.note.create({
        data: { id: randomUUID(), itemId: activeItemId, authorId: memberId, body: "TEAM-NOTE-SECRET" },
      });
      await prisma.personalNote.create({
        data: { id: randomUUID(), itemId: activeItemId, userId: memberId, body: "PERSONAL-NOTE-SECRET" },
      });

      const result = await exportListCsv(prisma, { userId: memberId, workspaceId, listId, now: NOW });

      assert.equal(result.status, "ok");
      if (result.status !== "ok") throw new Error("unreachable");
      assert.equal(result.filename, "platform-retrofit-2026-10-02.csv");
      const lines = result.body.slice(1).split("\r\n");
      assert.ok(lines[0]!.endsWith(",Owner"), lines[0]);
      assert.ok(lines[1]!.startsWith(`${activeItemId},Write spec,,Planning,To Do,,High,Ada,urgent,`), lines[1]);
      assert.ok(lines[1]!.endsWith(",Platform"), lines[1]);
      assert.ok(lines[2]!.startsWith(`${archivedItemId},Old idea,,,Archived,`), lines[2]);
      assert.ok(!result.body.includes("SECRET"), "Notes and Personal Notes must never be exported");
    }

    // Workspace Viewers and List Viewers can export; a Workspace Member with
    // no List role and a stranger are both told not-found, as is a List
    // requested through the wrong Workspace.
    {
      const { workspaceId, listId } = await createWorkspaceAndList();
      const otherWorkspace = await createWorkspaceAndList("Elsewhere");

      const workspaceViewer = await createUser("Viewer");
      await addWorkspaceMember(workspaceId, workspaceViewer, "VIEWER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: workspaceViewer, role: "MEMBER" } });
      const listViewer = await createUser("List Viewer");
      await addWorkspaceMember(workspaceId, listViewer, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: listViewer, role: "VIEWER" } });
      for (const userId of [workspaceViewer, listViewer]) {
        const result = await exportListCsv(prisma, { userId, workspaceId, listId, now: NOW });
        assert.equal(result.status, "ok", `expected ${userId} to export`);
      }

      const unassigned = await createUser("Unassigned");
      await addWorkspaceMember(workspaceId, unassigned, "MEMBER");
      const stranger = await createUser("Stranger");
      for (const userId of [unassigned, stranger]) {
        const result = await exportListCsv(prisma, { userId, workspaceId, listId, now: NOW });
        assert.deepEqual(result, { status: "not-found" }, `expected ${userId} to be refused`);
      }

      assert.deepEqual(
        await exportListCsv(prisma, {
          userId: workspaceViewer,
          workspaceId: otherWorkspace.workspaceId,
          listId,
          now: NOW,
        }),
        { status: "not-found" }
      );
      assert.deepEqual(
        await exportListCsv(prisma, { userId: workspaceViewer, workspaceId, listId: randomUUID(), now: NOW }),
        { status: "not-found" }
      );
    }

    console.log("list csv export integration tests passed");
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
