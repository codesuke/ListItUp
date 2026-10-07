import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createAttachment, getAttachmentForDownload, MAX_ATTACHMENT_SIZE_BYTES } from "./item-attachments";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("item attachments integration test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "Test User", email: `item-attachments-${userId}@example.test` },
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

  async function createTestItem(listId: string, creatorId: string, title = "Test Item"): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title, creatorId } });
    return itemId;
  }

  try {
    // A List Member can attach an allowed-type file within the size cap.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, userId);

      const result = await createAttachment(prisma, {
        actorUserId: userId,
        itemId,
        fileName: "spec.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        storageKey: `items/${itemId}/${randomUUID()}-spec.pdf`,
      });
      assert.equal(result.status, "created");
      assert.ok(result.status === "created" && result.attachmentId);

      const stored = await prisma.attachment.findUnique({
        where: { id: result.status === "created" ? result.attachmentId : "" },
      });
      assert.ok(stored);
      assert.equal(stored?.itemId, itemId);
      assert.equal(stored?.uploaderId, userId);
      assert.equal(stored?.fileName, "spec.pdf");
    }

    // An oversized file is rejected and no row is written.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, userId);

      const result = await createAttachment(prisma, {
        actorUserId: userId,
        itemId,
        fileName: "huge.zip",
        contentType: "application/zip",
        sizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1,
        storageKey: `items/${itemId}/${randomUUID()}-huge.zip`,
      });
      assert.deepEqual(result, { status: "too-large" });

      const count = await prisma.attachment.count({ where: { itemId } });
      assert.equal(count, 0);
    }

    // A disallowed content type is rejected.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, userId);

      const result = await createAttachment(prisma, {
        actorUserId: userId,
        itemId,
        fileName: "app.exe",
        contentType: "application/x-msdownload",
        sizeBytes: 1024,
        storageKey: `items/${itemId}/${randomUUID()}-app.exe`,
      });
      assert.deepEqual(result, { status: "type-not-allowed" });

      const count = await prisma.attachment.count({ where: { itemId } });
      assert.equal(count, 0);
    }

    // A List Viewer cannot attach a file.
    {
      const { listId, userId: viewerId } = await createWorkspaceListAndMember("VIEWER");
      const creatorId = await createUser();
      const itemId = await createTestItem(listId, creatorId);

      const result = await createAttachment(prisma, {
        actorUserId: viewerId,
        itemId,
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 10,
        storageKey: `items/${itemId}/${randomUUID()}-notes.txt`,
      });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // Attaching to a non-existent Item is reported distinctly from
    // "forbidden".
    {
      const { userId } = await createWorkspaceListAndMember();

      const result = await createAttachment(prisma, {
        actorUserId: userId,
        itemId: randomUUID(),
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 10,
        storageKey: `items/missing/${randomUUID()}-notes.txt`,
      });
      assert.deepEqual(result, { status: "item-not-found" });
    }

    // A List Viewer can download (read-only access is enough), but a User
    // without any access is forbidden.
    {
      const { listId, workspaceId, userId: memberId } = await createWorkspaceListAndMember();
      const viewerId = await createUser();
      await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId: viewerId, role: "MEMBER" } });
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: viewerId, role: "VIEWER" } });
      const itemId = await createTestItem(listId, memberId);
      const created = await createAttachment(prisma, {
        actorUserId: memberId,
        itemId,
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 10,
        storageKey: `items/${itemId}/${randomUUID()}-notes.txt`,
      });
      assert.equal(created.status, "created");
      const attachmentId = created.status === "created" ? created.attachmentId : "";

      const viewerResult = await getAttachmentForDownload(prisma, { actorUserId: viewerId, attachmentId });
      assert.equal(viewerResult.status, "ok");
      assert.equal(viewerResult.status === "ok" && viewerResult.fileName, "notes.txt");
      assert.equal(viewerResult.status === "ok" && viewerResult.contentType, "text/plain");
      assert.equal(
        viewerResult.status === "ok" && viewerResult.storageKey.startsWith(`items/${itemId}/`),
        true
      );

      const outsiderId = await createUser();
      const outsiderResult = await getAttachmentForDownload(prisma, { actorUserId: outsiderId, attachmentId });
      assert.deepEqual(outsiderResult, { status: "forbidden" });

      const missingResult = await getAttachmentForDownload(prisma, { actorUserId: memberId, attachmentId: randomUUID() });
      assert.deepEqual(missingResult, { status: "not-found" });
    }

    // Once the owning Workspace is soft-deleted, even a previously-valid
    // download is refused (#76).
    {
      const { listId, workspaceId, userId: memberId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, memberId);
      const created = await createAttachment(prisma, {
        actorUserId: memberId,
        itemId,
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 10,
        storageKey: `items/${itemId}/${randomUUID()}-notes.txt`,
      });
      assert.equal(created.status, "created");
      const attachmentId = created.status === "created" ? created.attachmentId : "";

      await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });

      const result = await getAttachmentForDownload(prisma, { actorUserId: memberId, attachmentId });
      assert.deepEqual(result, { status: "forbidden" });
    }

    // #104 story 9: uploading a new Attachment is refused with
    // list-archived once the Item's parent List is archived, and no row is
    // written.
    {
      const { listId, userId } = await createWorkspaceListAndMember();
      const itemId = await createTestItem(listId, userId);
      await prisma.list.update({ where: { id: listId }, data: { archivedAt: new Date() } });

      const result = await createAttachment(prisma, {
        actorUserId: userId,
        itemId,
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 10,
        storageKey: `items/${itemId}/${randomUUID()}-notes.txt`,
      });
      assert.deepEqual(result, { status: "list-archived" });
      const attachmentCount = await prisma.attachment.count({ where: { itemId } });
      assert.equal(attachmentCount, 0);
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.attachment.deleteMany({ where: { item: { listId: { in: listIds } } } });
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

  console.log("item attachments integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
