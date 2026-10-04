import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { Mailer, SendEmailInput, SendEmailResult } from "@/lib/mailer/mailer-core";
import {
  notifyMembersOfWorkspaceDeletion,
  notifyMembersOfWorkspaceRestoration,
} from "./workspace-deletion-notifications";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace deletion notifications test skipped: DATABASE_URL is not set");
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
    const email = `workspace-deletion-notice-${userId}@example.test`;
    await prisma.user.create({ data: { id: userId, name, email } });
    return { id: userId, email };
  }

  async function createWorkspace(name: string): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind: "SHARED" } });
    return workspaceId;
  }

  async function addMember(
    workspaceId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
    name: string
  ): Promise<{ id: string; email: string }> {
    const user = await createUser(name);
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: user.id, role },
    });
    return user;
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

  try {
    // Deleting a Workspace emails every other member naming the deleting
    // Owner and the Restore Window deadline, but not the Owner themselves.
    {
      const workspaceId = await createWorkspace("Launch Team");
      const owner = await addMember(workspaceId, "OWNER", "Priya");
      const admin = await addMember(workspaceId, "ADMIN", "Alex");
      const member = await addMember(workspaceId, "MEMBER", "Sam");

      const { mailer, sentEmails } = fakeMailer();
      const deletedAt = new Date("2026-01-01T00:00:00.000Z");

      await notifyMembersOfWorkspaceDeletion(prisma, mailer, {
        workspaceId,
        workspaceName: "Launch Team",
        deletedByUserId: owner.id,
        deletedByName: "Priya",
        deletedAt,
      });

      assert.equal(sentEmails.length, 2, "only the two non-deleting members are emailed");
      const recipients = sentEmails.map((email) => email.to).sort();
      assert.deepEqual(recipients, [admin.email, member.email].sort());
      assert.ok(
        sentEmails.every((email) => email.type === "workspace-deleted-notice"),
        "all emails use the workspace-deleted-notice type"
      );
      assert.ok(sentEmails.every((email) => email.template.html.includes("Priya")));
      assert.ok(sentEmails.every((email) => email.template.html.includes("April 1, 2026")));
    }

    // Restoring a Workspace emails every other member that access is back,
    // but not the Owner who restored it.
    {
      const workspaceId = await createWorkspace("Launch Team");
      const owner = await addMember(workspaceId, "OWNER", "Priya");
      const member = await addMember(workspaceId, "MEMBER", "Sam");

      const { mailer, sentEmails } = fakeMailer();

      await notifyMembersOfWorkspaceRestoration(prisma, mailer, {
        workspaceId,
        workspaceName: "Launch Team",
        restoredByUserId: owner.id,
      });

      assert.equal(sentEmails.length, 1, "only the non-restoring member is emailed");
      assert.equal(sentEmails[0].to, member.email);
      assert.equal(sentEmails[0].type, "workspace-restored-notice");
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace deletion notifications test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
