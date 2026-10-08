import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createNote, getPersonalNote, upsertPersonalNote } from "./item-notes";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item notes integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-notes-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceListAndMember(
    listRole: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<{ workspaceId: string; listId: string; userId: string }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });
    const userId = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: listRole } });
    return { workspaceId, listId, userId };
  }

  async function addListMember(
    workspaceId: string,
    listId: string,
    listRole: "LEAD" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<string> {
    const userId = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: listRole } });
    return userId;
  }

  async function createTestItem(listId: string, creatorId: string, title = "Test Item"): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title, creatorId } });
    return itemId;
  }

  try {
    // A List Member can add a Note, mentioning another User who already has
    // access to the Item.
    {
      const { workspaceId, listId, userId } = await createWorkspaceListAndMember();
      const mentioned = await addListMember(workspaceId, listId, "VIEWER");
      const itemId = await createTestItem(listId, userId);

      const result = await createNote(prisma, {
        actorUserId: userId,
        itemId,
        body: "Looping you in on this.",
        mentionedUserIds: [mentioned],
      });
      assert.equal(result.status, "created");
      const noteId = result.status === "created" ? result.noteId : "";

      const stored = await prisma.note.findUnique({ where: { id: noteId }, include: { mentions: true } });
      assert.ok(stored);
      assert.equal(stored?.itemId, itemId);
      assert.equal(stored?.authorId, userId);
      assert.equal(stored?.mentions.length, 1);
      assert.equal(stored?.mentions[0]?.userId, mentioned);
    }

    // Mentioning a User without access to the Item is rejected, and no
    // Note or Mention row is written.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const outsider = await createUser();
      const itemId = await createTestItem(listId, userId);

      const result = await createNote(prisma, {
        actorUserId: userId,
        itemId,
        body: "Can't loop this person in.",
        mentionedUserIds: [outsider],
      });
      assert.deepEqual(result, { status: "mention-not-allowed", userId: outsider });

      const count = await prisma.note.count({ where: { itemId } });
      assert.equal(count, 0);
    }

    // A List Viewer cannot add a Note.
    {
      const { listId, userId: viewerId } = await createWorkspaceListAndMember("VIEWER");
      const creatorId = await createUser();
      const itemId = await createTestItem(listId, creatorId);

      const result = await createNote(prisma, { actorUserId: viewerId, itemId, body: "Trying to add a note." });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // Adding a Note to a non-existent Item is reported distinctly from
    // "forbidden".
    {
      const { userId } = await createWorkspaceListAndMember();

      const result = await createNote(prisma, { actorUserId: userId, itemId: randomUUID(), body: "Nope." });
      assert.deepEqual(result, { status: "item-not-found" });
    }

    // An Assignee can upsert their own Personal Note, visible only to them.
    {
      const { workspaceId, listId, userId: creatorId } = await createWorkspaceListAndMember();
      const assigneeId = await addListMember(workspaceId, listId, "VIEWER");
      const itemId = await createTestItem(listId, creatorId);
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId: assigneeId } });

      const created = await upsertPersonalNote(prisma, {
        actorUserId: assigneeId,
        itemId,
        body: "Private plan: finish by Friday.",
      });
      assert.deepEqual(created, { status: "ok" });

      const ownerView = await getPersonalNote(prisma, { actorUserId: assigneeId, itemId });
      assert.deepEqual(ownerView, { body: "Private plan: finish by Friday." });

      const othersView = await getPersonalNote(prisma, { actorUserId: creatorId, itemId });
      assert.equal(othersView, null);

      const updated = await upsertPersonalNote(prisma, {
        actorUserId: assigneeId,
        itemId,
        body: "Private plan: actually finish by Monday.",
      });
      assert.deepEqual(updated, { status: "ok" });

      const updatedView = await getPersonalNote(prisma, { actorUserId: assigneeId, itemId });
      assert.deepEqual(updatedView, { body: "Private plan: actually finish by Monday." });

      const rowCount = await prisma.personalNote.count({ where: { itemId, userId: assigneeId } });
      assert.equal(rowCount, 1);
    }

    // A User who isn't an Assignee cannot attach a Personal Note, even with
    // full List access.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, userId);

      const result = await upsertPersonalNote(prisma, { actorUserId: userId, itemId, body: "Not assigned." });
      assert.deepEqual(result, { status: "not-assignee" });
    }

    // #104 story 8: creating a shared Note is refused with list-archived
    // once the Item's parent List is archived.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, userId);
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const result = await createNote(prisma, { actorUserId: userId, itemId, body: "Should not be saved." });
      assert.deepEqual(result, { status: "list-archived" });
      const noteCount = await prisma.note.count({ where: { itemId } });
      assert.equal(noteCount, 0);
    }

    // #104 story 12: a Personal Note is explicitly exempt from the
    // archived-List mutation block — an Assignee can still upsert their own
    // Personal Note on an archived List's Item.
    {
      const { workspaceId, listId, userId: creatorId } = await createWorkspaceListAndMember();
      const assigneeId = await addListMember(workspaceId, listId, "VIEWER");
      const itemId = await createTestItem(listId, creatorId);
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId: assigneeId } });
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const result = await upsertPersonalNote(prisma, {
        actorUserId: assigneeId,
        itemId,
        body: "Still allowed on an archived List.",
      });
      assert.deepEqual(result, { status: "ok" });
      const note = await getPersonalNote(prisma, { actorUserId: assigneeId, itemId });
      assert.deepEqual(note, { body: "Still allowed on an archived List." });
    }

    // #107/ADR 0021: once the caller's List access drops below READ, both
    // functions refuse — getPersonalNote as "not found", upsertPersonalNote
    // as "forbidden" — even while a stale ItemAssignee row for them still
    // exists. Access being restored brings both back without recreating
    // the Note or the assignment.
    {
      const { workspaceId, listId, userId: creatorId } = await createWorkspaceListAndMember();
      const assigneeId = await addListMember(workspaceId, listId, "VIEWER");
      const itemId = await createTestItem(listId, creatorId);
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId: assigneeId } });

      const created = await upsertPersonalNote(prisma, {
        actorUserId: assigneeId,
        itemId,
        body: "Written while I still had access.",
      });
      assert.deepEqual(created, { status: "ok" });

      await prisma.listMember.deleteMany({ where: { listId, userId: assigneeId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: assigneeId } });

      const rejectedRead = await getPersonalNote(prisma, { actorUserId: assigneeId, itemId });
      assert.equal(rejectedRead, null, "a lost-access caller must see 'not found', not the row's real content");

      const rejectedWrite = await upsertPersonalNote(prisma, {
        actorUserId: assigneeId,
        itemId,
        body: "Should not be written.",
      });
      assert.deepEqual(rejectedWrite, { status: "forbidden" });

      const assigneeStillExists = await prisma.itemAssignee.findUnique({
        where: { itemId_userId: { itemId, userId: assigneeId } },
      });
      assert.ok(assigneeStillExists, "the stale ItemAssignee row must not be deleted by access loss alone");
      const noteRow = await prisma.personalNote.findUnique({ where: { itemId_userId: { itemId, userId: assigneeId } } });
      assert.equal(noteRow?.body, "Written while I still had access.", "the Note row must survive untouched");

      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: assigneeId, role: "MEMBER" } });
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: assigneeId, role: "VIEWER" } });

      const restoredRead = await getPersonalNote(prisma, { actorUserId: assigneeId, itemId });
      assert.deepEqual(restoredRead, { body: "Written while I still had access." });

      const restoredWrite = await upsertPersonalNote(prisma, {
        actorUserId: assigneeId,
        itemId,
        body: "Updated after access was restored.",
      });
      assert.deepEqual(restoredWrite, { status: "ok" });
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.mention.deleteMany({ where: { note: { item: { listId: { in: listIds } } } } });
    await prisma.note.deleteMany({ where: { item: { listId: { in: listIds } } } });
    await prisma.personalNote.deleteMany({ where: { item: { listId: { in: listIds } } } });
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

  console.log("item notes integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
