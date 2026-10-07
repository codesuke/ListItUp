import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createSection,
  deleteSection,
  duplicateSection,
  renameSection,
  reorderSections,
  setListGroupBy,
} from "./list-sections";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list sections integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `list-sections-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithList(): Promise<{ workspaceId: string; listId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    return { workspaceId, listId };
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  async function addListMember(
    listId: string,
    userId: string,
    role: "LEAD" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
  }

  try {
    // A List Member (not just Lead) can create a Section, and it gets the
    // next order value.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const first = await createSection(prisma, { actorUserId: memberId, listId, name: "To Do" });
      assert.equal(first.status, "created");
      const second = await createSection(prisma, { actorUserId: memberId, listId, name: "Done" });
      assert.equal(second.status, "created");

      const sections = await prisma.section.findMany({ where: { listId }, orderBy: { order: "asc" } });
      assert.deepEqual(sections.map((s) => s.name), ["To Do", "Done"]);
      assert.deepEqual(sections.map((s) => s.order), [0, 1]);
    }

    // A List Viewer cannot create a Section.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");

      const result = await createSection(prisma, { actorUserId: viewerId, listId, name: "Should not exist" });
      assert.deepEqual(result, { status: "forbidden" });
      const sections = await prisma.section.findMany({ where: { listId } });
      assert.equal(sections.length, 0);
    }

    // A Guest cannot create a Section.
    {
      const { listId } = await createWorkspaceWithList();
      const guestId = await createUser();
      await prisma.guest.create({ data: { id: randomUUID(), listId, userId: guestId } });

      const result = await createSection(prisma, { actorUserId: guestId, listId, name: "Should not exist" });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // Rename/Duplicate/Delete all authorize the same way.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");
      const created = await createSection(prisma, { actorUserId: memberId, listId, name: "Original" });
      assert.ok(created.status === "created");
      const sectionId = created.status === "created" ? created.sectionId : "";

      const renamed = await renameSection(prisma, { actorUserId: memberId, sectionId, name: "Renamed" });
      assert.deepEqual(renamed, { status: "renamed" });
      let section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
      assert.equal(section.name, "Renamed");

      const duplicated = await duplicateSection(prisma, { actorUserId: memberId, sectionId });
      assert.equal(duplicated.status, "duplicated");
      const duplicateId = duplicated.status === "duplicated" ? duplicated.sectionId : "";
      const duplicate = await prisma.section.findUniqueOrThrow({ where: { id: duplicateId } });
      assert.equal(duplicate.name, "Renamed (copy)");
      assert.equal(duplicate.order, 1);

      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");
      const forbiddenRename = await renameSection(prisma, { actorUserId: viewerId, sectionId, name: "Nope" });
      assert.deepEqual(forbiddenRename, { status: "forbidden" });

      const deleted = await deleteSection(prisma, { actorUserId: memberId, sectionId: duplicateId });
      assert.deepEqual(deleted, { status: "deleted" });
      section = (await prisma.section.findUnique({ where: { id: duplicateId } })) as never;
      assert.equal(section, null);
    }

    // Reordering persists the new order and rejects a payload that isn't
    // an exact permutation of the List's existing Sections.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const a = await createSection(prisma, { actorUserId: leadId, listId, name: "A" });
      const b = await createSection(prisma, { actorUserId: leadId, listId, name: "B" });
      const c = await createSection(prisma, { actorUserId: leadId, listId, name: "C" });
      const ids = [a, b, c].map((r) => (r.status === "created" ? r.sectionId : ""));

      const reordered = await reorderSections(prisma, {
        actorUserId: leadId,
        listId,
        orderedSectionIds: [ids[2], ids[0], ids[1]],
      });
      assert.deepEqual(reordered, { status: "reordered" });

      const sections = await prisma.section.findMany({ where: { listId }, orderBy: { order: "asc" } });
      assert.deepEqual(sections.map((s) => s.id), [ids[2], ids[0], ids[1]]);

      const invalid = await reorderSections(prisma, {
        actorUserId: leadId,
        listId,
        orderedSectionIds: [ids[0], ids[1]],
      });
      assert.deepEqual(invalid, { status: "invalid-order" });
    }

    // A List Member can change the List view's grouping ("Add Rule"); a
    // List Viewer cannot.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await addListMember(listId, memberId, "MEMBER");

      const result = await setListGroupBy(prisma, { actorUserId: memberId, listId, groupBy: "SECTION" });
      assert.deepEqual(result, { status: "updated" });

      const invalid = await setListGroupBy(prisma, { actorUserId: memberId, listId, groupBy: "NOT_A_FIELD" });
      assert.deepEqual(invalid, { status: "invalid-group-by" });

      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "MEMBER");
      await addListMember(listId, viewerId, "VIEWER");
      const forbidden = await setListGroupBy(prisma, { actorUserId: viewerId, listId, groupBy: "SECTION" });
      assert.deepEqual(forbidden, { status: "forbidden" });
    }

    // #104 story 4: every Section mutation is refused with list-archived on
    // an archived List, even for a Lead, with no observable side effect.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createUser();
      await addWorkspaceMember(workspaceId, leadId, "MEMBER");
      await addListMember(listId, leadId, "LEAD");

      const created = await createSection(prisma, { actorUserId: leadId, listId, name: "Before archiving" });
      assert.equal(created.status, "created");
      const sectionId = created.status === "created" ? created.sectionId : "";

      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      assert.deepEqual(await createSection(prisma, { actorUserId: leadId, listId, name: "New section" }), {
        status: "list-archived",
      });
      assert.deepEqual(await renameSection(prisma, { actorUserId: leadId, sectionId, name: "Renamed" }), {
        status: "list-archived",
      });
      assert.deepEqual(await duplicateSection(prisma, { actorUserId: leadId, sectionId }), {
        status: "list-archived",
      });
      assert.deepEqual(await reorderSections(prisma, { actorUserId: leadId, listId, orderedSectionIds: [sectionId] }), {
        status: "list-archived",
      });
      assert.deepEqual(await deleteSection(prisma, { actorUserId: leadId, sectionId }), {
        status: "list-archived",
      });

      const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
      assert.equal(section.name, "Before archiving", "Section must be untouched");
      const sectionCount = await prisma.section.count({ where: { listId } });
      assert.equal(sectionCount, 1, "no Section may be added or removed");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.guest.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.section.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list sections integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
