import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { resolveListAccess } from "@/lib/permissions/list-access";

import { addListMember, changeListMemberRole, removeListMember } from "./list-membership";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list membership integration test skipped: DATABASE_URL is not set");
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
  const createdListIds: string[] = [];

  async function createWorkspaceWithList(): Promise<{
    workspaceId: string;
    listId: string;
  }> {
    const workspaceId = randomUUID();
    const listId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    createdListIds.push(listId);

    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team" } });
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Checklist" } });

    return { workspaceId, listId };
  }

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: "User", email: `user-${randomUUID()}@example.test` },
    });

    return userId;
  }

  async function addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
  }

  // Creates a User who is both a Workspace Member and this List's Lead, so
  // tests have a valid actor without repeating the setup each time.
  async function createListLead(workspaceId: string, listId: string): Promise<string> {
    const leadId = await createUser();
    await addWorkspaceMember(workspaceId, leadId, "MEMBER");
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
    return leadId;
  }

  try {
    // A List Lead can add a User who already holds a Workspace-level
    // membership, with an explicit List-level role.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");

      const result = await addListMember(prisma, { actorUserId: leadId, listId, userId: targetId, role: "VIEWER" });

      assert.deepEqual(result, { status: "added" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: targetId } },
      });
      assert.equal(membership?.role, "VIEWER");
    }

    // A User with no Workspace-level membership in the List's Workspace is
    // rejected as a target, even for a valid actor.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const outsiderId = await createUser();

      const result = await addListMember(prisma, { actorUserId: leadId, listId, userId: outsiderId, role: "MEMBER" });

      assert.deepEqual(result, { status: "user-lacks-workspace-membership" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: outsiderId } },
      });
      assert.equal(membership, null);
    }

    // A Workspace Admin (no explicit List role) can also add a Member.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const adminId = await createUser();
      await addWorkspaceMember(workspaceId, adminId, "ADMIN");
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");

      const result = await addListMember(prisma, { actorUserId: adminId, listId, userId: targetId, role: "MEMBER" });
      assert.deepEqual(result, { status: "added" });
    }

    // A List Member (not Lead) cannot add another Member — only a List Lead
    // or Workspace Admin/Owner can.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");

      const result = await addListMember(prisma, { actorUserId: memberId, listId, userId: targetId, role: "VIEWER" });

      assert.deepEqual(result, { status: "forbidden" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: targetId } },
      });
      assert.equal(membership, null);
    }

    // A non-existent List is reported rather than silently creating one.
    {
      const actorId = await createUser();
      const targetId = await createUser();

      const result = await addListMember(prisma, {
        actorUserId: actorId,
        listId: randomUUID(),
        userId: targetId,
        role: "MEMBER",
      });

      assert.deepEqual(result, { status: "list-not-found" });
    }

    // A List Lead can remove a List Member.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "MEMBER" } });

      const result = await removeListMember(prisma, { actorUserId: leadId, listId, userId: targetId });

      assert.deepEqual(result, { status: "removed" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: targetId } },
      });
      assert.equal(membership, null);
    }

    // A List Member cannot remove another Member.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });
      const targetId = await createUser();
      await addWorkspaceMember(workspaceId, targetId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: targetId, role: "VIEWER" } });

      const result = await removeListMember(prisma, { actorUserId: memberId, listId, userId: targetId });

      assert.deepEqual(result, { status: "forbidden" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: targetId } },
      });
      assert.ok(membership, "target must remain a List Member");
    }

    // A Workspace Viewer granted a higher List-level role (e.g. List Lead)
    // still resolves to read-only effective access — the Viewer ceiling
    // holds even after this ticket's own mutation grants it.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const viewerId = await createUser();
      await addWorkspaceMember(workspaceId, viewerId, "VIEWER");

      const result = await addListMember(prisma, { actorUserId: leadId, listId, userId: viewerId, role: "LEAD" });
      assert.deepEqual(result, { status: "added" });

      const access = await resolveListAccess(prisma, { userId: viewerId, listId });
      assert.equal(access, "READ", "the Workspace Viewer ceiling must still hold");
    }

    // Adding an existing Lead via the add-member path never demotes them,
    // even when a lower role is explicitly requested (#95).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const otherLeadId = await createListLead(workspaceId, listId);

      const result = await addListMember(prisma, { actorUserId: leadId, listId, userId: otherLeadId, role: "VIEWER" });

      assert.deepEqual(result, { status: "added" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: otherLeadId } },
      });
      assert.equal(membership?.role, "LEAD", "an existing Lead must never be silently demoted by an add");
    }

    // Removing a List's only Lead is blocked, for a Lead, an Admin, and the
    // Workspace Owner alike (#95).
    for (const actorRole of ["LEAD", "ADMIN", "OWNER"] as const) {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const soleLeadId = await createListLead(workspaceId, listId);

      let actorId: string;
      if (actorRole === "LEAD") {
        actorId = soleLeadId;
      } else {
        actorId = await createUser();
        await addWorkspaceMember(workspaceId, actorId, actorRole);
      }

      const result = await removeListMember(prisma, { actorUserId: actorId, listId, userId: soleLeadId });

      assert.deepEqual(result, { status: "last-lead" }, `a ${actorRole} actor must not remove the sole Lead`);
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: soleLeadId } },
      });
      assert.equal(membership?.role, "LEAD", "the sole Lead must remain a List Lead");
    }

    // Removing a Lead succeeds once another Lead remains.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const otherLeadId = await createListLead(workspaceId, listId);

      const result = await removeListMember(prisma, { actorUserId: leadId, listId, userId: otherLeadId });

      assert.deepEqual(result, { status: "removed" });
    }

    // changeListMemberRole promotes a Member to Lead with no last-Lead
    // concern (it only ever grows the Lead count).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const memberId = await createUser();
      await addWorkspaceMember(workspaceId, memberId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });

      const result = await changeListMemberRole(prisma, { actorUserId: leadId, listId, userId: memberId, role: "LEAD" });

      assert.deepEqual(result, { status: "changed" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: memberId } } });
      assert.equal(membership?.role, "LEAD");
    }

    // Demoting a List's only Lead straight to Viewer is blocked too — the
    // guard isn't specific to Member (#95).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const soleLeadId = await createListLead(workspaceId, listId);

      const result = await changeListMemberRole(prisma, {
        actorUserId: soleLeadId,
        listId,
        userId: soleLeadId,
        role: "VIEWER",
      });

      assert.deepEqual(result, { status: "last-lead" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: soleLeadId } } });
      assert.equal(membership?.role, "LEAD", "the sole Lead must not be demoted to Viewer either");
    }

    // Demoting a Lead to Viewer succeeds once another Lead remains.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadId = await createListLead(workspaceId, listId);
      const otherLeadId = await createListLead(workspaceId, listId);

      const result = await changeListMemberRole(prisma, {
        actorUserId: leadId,
        listId,
        userId: otherLeadId,
        role: "VIEWER",
      });

      assert.deepEqual(result, { status: "changed" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: otherLeadId } } });
      assert.equal(membership?.role, "VIEWER");
    }

    // Demoting a List's only Lead to Member is blocked, including when the
    // Lead is demoting themselves (stepping down) with nobody to hand over
    // to (#95).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const soleLeadId = await createListLead(workspaceId, listId);

      const result = await changeListMemberRole(prisma, {
        actorUserId: soleLeadId,
        listId,
        userId: soleLeadId,
        role: "MEMBER",
      });

      assert.deepEqual(result, { status: "last-lead" });
      const membership = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId: soleLeadId } } });
      assert.equal(membership?.role, "LEAD", "a sole Lead must not be able to step down");
    }

    // A Lead handover is promote-then-step-down: promoting a Member to Lead
    // and then having the original Lead step down both succeed, in order,
    // with no dedicated transfer action (#94, #95).
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const originalLeadId = await createListLead(workspaceId, listId);
      const successorId = await createUser();
      await addWorkspaceMember(workspaceId, successorId, "MEMBER");
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: successorId, role: "MEMBER" } });

      const promotion = await changeListMemberRole(prisma, {
        actorUserId: originalLeadId,
        listId,
        userId: successorId,
        role: "LEAD",
      });
      assert.deepEqual(promotion, { status: "changed" });

      const stepDown = await changeListMemberRole(prisma, {
        actorUserId: originalLeadId,
        listId,
        userId: originalLeadId,
        role: "MEMBER",
      });
      assert.deepEqual(stepDown, { status: "changed" });

      const successorMembership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: successorId } },
      });
      assert.equal(successorMembership?.role, "LEAD");
      const originalLeadMembership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: originalLeadId } },
      });
      assert.equal(originalLeadMembership?.role, "MEMBER");
    }

    // Two simultaneous demotions of a List's last two Leads: exactly one
    // succeeds, the other is told it would strand the List (#95 user story
    // 32). The List row lock inside changeListMemberRole serializes the
    // two transactions rather than letting both read a stale Lead count.
    {
      const { workspaceId, listId } = await createWorkspaceWithList();
      const leadAId = await createListLead(workspaceId, listId);
      const leadBId = await createListLead(workspaceId, listId);

      const [resultA, resultB] = await Promise.all([
        changeListMemberRole(prisma, { actorUserId: leadAId, listId, userId: leadAId, role: "MEMBER" }),
        changeListMemberRole(prisma, { actorUserId: leadBId, listId, userId: leadBId, role: "MEMBER" }),
      ]);

      const outcomes = [resultA.status, resultB.status].sort();
      assert.deepEqual(outcomes, ["changed", "last-lead"]);

      const remainingLeads = await prisma.listMember.count({ where: { listId, role: "LEAD" } });
      assert.equal(remainingLeads, 1, "exactly one Lead must remain");
    }
  } finally {
    await prisma.listMember.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.list.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list membership integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
