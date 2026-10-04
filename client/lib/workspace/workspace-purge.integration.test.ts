import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { Mailer, SendEmailInput, SendEmailResult } from "@/lib/mailer/mailer-core";
import { RESTORE_WINDOW_MONTHS } from "./workspace-deletion";
import { purgeExpiredWorkspaces, PURGE_WARNING_LEAD_TIME_DAYS, type AttachmentObjectStore } from "./workspace-purge";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace purge test skipped: DATABASE_URL is not set");
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

  async function createUser(name: string): Promise<{ id: string; email: string }> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    const email = `workspace-purge-${userId}@example.test`;
    await prisma.user.create({ data: { id: userId, name, email } });
    return { id: userId, email };
  }

  async function createWorkspace(name: string, deletedAt: Date | null): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind: "SHARED", deletedAt } });
    return workspaceId;
  }

  async function addOwner(workspaceId: string, name: string): Promise<{ id: string; email: string }> {
    const user = await createUser(name);
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: user.id, role: "OWNER" },
    });
    return user;
  }

  async function addAttachment(workspaceId: string, ownerId: string): Promise<{ storageKey: string }> {
    const listId = randomUUID();
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Files" } });
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title: "Spec", creatorId: ownerId } });
    const storageKey = `items/${itemId}/${randomUUID()}-spec.pdf`;
    await prisma.attachment.create({
      data: {
        id: randomUUID(),
        itemId,
        uploaderId: ownerId,
        fileName: "spec.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        storageKey,
      },
    });
    return { storageKey };
  }

  function fakeMailer(): { mailer: Mailer; sentEmails: SendEmailInput[] } {
    const sentEmails: SendEmailInput[] = [];
    return {
      sentEmails,
      mailer: {
        async send(input: SendEmailInput): Promise<SendEmailResult> {
          sentEmails.push(input);
          return { ok: true };
        },
      },
    };
  }

  function fakeObjectStore(): { objectStore: AttachmentObjectStore; deletedKeys: string[] } {
    const deletedKeys: string[] = [];
    return {
      deletedKeys,
      objectStore: {
        async deleteObject(storageKey: string): Promise<void> {
          deletedKeys.push(storageKey);
        },
      },
    };
  }

  // A fixed instant so "past the window" / "near the window's end" math
  // doesn't depend on when the test happens to run.
  const now = new Date("2026-04-01T00:00:00.000Z");

  function monthsAgo(months: number, daysOffset = 0): Date {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    date.setDate(date.getDate() + daysOffset);
    return date;
  }

  try {
    // A Workspace past its Restore Window is hard-deleted along with its
    // List/Item, its Attachment's stored object is removed, and the purge
    // is recorded as a security event.
    {
      const workspaceId = await createWorkspace("Stale Co", monthsAgo(RESTORE_WINDOW_MONTHS + 1));
      const owner = await addOwner(workspaceId, "Priya");
      const { storageKey } = await addAttachment(workspaceId, owner.id);

      const { mailer } = fakeMailer();
      const { objectStore, deletedKeys } = fakeObjectStore();

      const result = await purgeExpiredWorkspaces(prisma, { mailer, objectStore }, now);

      assert.ok(result.purgedWorkspaceIds.includes(workspaceId));
      assert.deepEqual(deletedKeys, [storageKey], "the Attachment's object must be removed from storage");
      assert.equal(
        await prisma.workspace.findUnique({ where: { id: workspaceId } }),
        null,
        "the Workspace row must be hard-deleted"
      );
      const events = await prisma.securityEvent.findMany({
        where: { type: "workspace-purged", userId: owner.id },
      });
      assert.equal(events.length, 1, "purge must be recorded as a security event");
    }

    // A Workspace still well inside its Restore Window is untouched: no
    // purge, no warning email yet.
    {
      const workspaceId = await createWorkspace("Mid Window Co", monthsAgo(1));
      const owner = await addOwner(workspaceId, "Alex");

      const { mailer, sentEmails } = fakeMailer();
      const { objectStore } = fakeObjectStore();

      const result = await purgeExpiredWorkspaces(prisma, { mailer, objectStore }, now);

      assert.ok(!result.purgedWorkspaceIds.includes(workspaceId));
      assert.ok(!result.warnedWorkspaceIds.includes(workspaceId));
      assert.equal(sentEmails.length, 0);
      assert.ok(
        await prisma.workspace.findUnique({ where: { id: workspaceId } }),
        "a Workspace inside the window must survive the sweep"
      );
      void owner;
    }

    // An active Workspace (never deleted) is untouched by the sweep.
    {
      const workspaceId = await createWorkspace("Active Co", null);
      await addOwner(workspaceId, "Sam");

      const { mailer, sentEmails } = fakeMailer();
      const { objectStore } = fakeObjectStore();

      const result = await purgeExpiredWorkspaces(prisma, { mailer, objectStore }, now);

      assert.ok(!result.purgedWorkspaceIds.includes(workspaceId));
      assert.ok(!result.warnedWorkspaceIds.includes(workspaceId));
      assert.equal(sentEmails.length, 0);
    }

    // Close to the end of the Restore Window, the Owner is warned once by
    // email; running the sweep again does not send a second one.
    {
      const workspaceId = await createWorkspace(
        "Almost Expired Co",
        monthsAgo(RESTORE_WINDOW_MONTHS, PURGE_WARNING_LEAD_TIME_DAYS - 2)
      );
      const owner = await addOwner(workspaceId, "Priya");

      const first = fakeMailer();
      const { objectStore } = fakeObjectStore();
      const firstResult = await purgeExpiredWorkspaces(prisma, { mailer: first.mailer, objectStore }, now);

      assert.ok(firstResult.warnedWorkspaceIds.includes(workspaceId));
      assert.ok(!firstResult.purgedWorkspaceIds.includes(workspaceId));
      assert.equal(first.sentEmails.length, 1);
      assert.equal(first.sentEmails[0].to, owner.email);
      assert.equal(first.sentEmails[0].type, "workspace-purge-warning-notice");

      const second = fakeMailer();
      const secondResult = await purgeExpiredWorkspaces(prisma, { mailer: second.mailer, objectStore }, now);

      assert.ok(!secondResult.warnedWorkspaceIds.includes(workspaceId), "the warning must be sent only once");
      assert.equal(second.sentEmails.length, 0);
    }
  } finally {
    await prisma.securityEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.attachment.deleteMany({
      where: { item: { list: { workspaceId: { in: createdWorkspaceIds } } } },
    });
    await prisma.item.deleteMany({ where: { list: { workspaceId: { in: createdWorkspaceIds } } } });
    await prisma.list.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace purge test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
