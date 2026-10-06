import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { Mailer, SendEmailInput, SendEmailResult } from "@/lib/mailer/mailer-core";
import { notifyWorkspaceMembershipChange } from "./workspace-membership-notifications";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace membership notifications test skipped: DATABASE_URL is not set");
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
    const email = `workspace-membership-notice-${userId}@example.test`;
    await prisma.user.create({ data: { id: userId, name, email } });
    return { id: userId, email };
  }

  async function createWorkspace(name: string): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind: "SHARED" } });
    return workspaceId;
  }

  function fakeMailer(options: { fail?: boolean } = {}): { mailer: Mailer; sentEmails: SendEmailInput[] } {
    const sentEmails: SendEmailInput[] = [];
    return {
      sentEmails,
      mailer: {
        async send(input: SendEmailInput): Promise<SendEmailResult> {
          sentEmails.push(input);
          return options.fail ? { ok: false, reason: "send-failed" } : { ok: true };
        },
      },
    };
  }

  try {
    // A removal notice creates an in-app Notification for the removed
    // person, anchored to the Workspace (it has no Item), and emails them
    // naming who removed them.
    {
      const workspaceId = await createWorkspace("Launch Team");
      const actor = await createUser("Priya");
      const recipient = await createUser("Sam");
      const { mailer, sentEmails } = fakeMailer();

      await notifyWorkspaceMembershipChange(prisma, mailer, {
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        actorUserId: actor.id,
        actorName: "Priya",
        workspaceId,
        workspaceName: "Launch Team",
        notice: { type: "removed" },
      });

      const notification = await prisma.notification.findFirstOrThrow({
        where: { recipientId: recipient.id, type: "WORKSPACE_MEMBER_REMOVED" },
      });
      assert.equal(notification.workspaceId, workspaceId);
      assert.equal(notification.itemId, null);
      assert.equal(notification.actorId, actor.id);
      assert.equal(notification.newRole, null);

      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, recipient.email);
      assert.equal(sentEmails[0].type, "workspace-member-removed-notice");
      assert.ok(sentEmails[0].template.html.includes("Priya"));
    }

    // A role-change notice creates an in-app Notification snapshotting the
    // new role, and emails the recipient naming it.
    {
      const workspaceId = await createWorkspace("Launch Team");
      const actor = await createUser("Priya");
      const recipient = await createUser("Sam");
      const { mailer, sentEmails } = fakeMailer();

      await notifyWorkspaceMembershipChange(prisma, mailer, {
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        actorUserId: actor.id,
        actorName: "Priya",
        workspaceId,
        workspaceName: "Launch Team",
        notice: { type: "role-changed", newRole: "ADMIN" },
      });

      const notification = await prisma.notification.findFirstOrThrow({
        where: { recipientId: recipient.id, type: "WORKSPACE_ROLE_CHANGED" },
      });
      assert.equal(notification.workspaceId, workspaceId);
      assert.equal(notification.itemId, null);
      assert.equal(notification.newRole, "ADMIN");

      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].type, "workspace-role-changed-notice");
      assert.ok(sentEmails[0].template.html.includes("Admin"));
    }

    // A delivery failure never rolls back the in-app Notification, and the
    // caller doesn't receive an error — mailer.send already swallows the
    // failure (mailer-core.ts), this just confirms the create still
    // committed and nothing throws.
    {
      const workspaceId = await createWorkspace("Launch Team");
      const actor = await createUser("Priya");
      const recipient = await createUser("Sam");
      const { mailer } = fakeMailer({ fail: true });

      await assert.doesNotReject(
        notifyWorkspaceMembershipChange(prisma, mailer, {
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          actorUserId: actor.id,
          actorName: "Priya",
          workspaceId,
          workspaceName: "Launch Team",
          notice: { type: "removed" },
        })
      );

      const count = await prisma.notification.count({
        where: { recipientId: recipient.id, type: "WORKSPACE_MEMBER_REMOVED", workspaceId },
      });
      assert.equal(count, 1, "the in-app Notification is created even when email delivery fails");
    }
  } finally {
    await prisma.notification.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace membership notifications test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
