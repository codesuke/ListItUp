import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { resolveListAccess } from "@/lib/permissions/list-access";

import { leaveWorkspace, removeWorkspaceMember } from "./workspace-membership";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace membership integration test skipped: DATABASE_URL is not set");
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

  async function createWorkspace(kind: "SHARED" | "PERSONAL" = "SHARED"): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team", kind } });
    return workspaceId;
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
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<string> {
    const userId = await createUser();
    await prisma.workspaceMember.create({ data: { id: randomUUID(), workspaceId, userId, role } });
    return userId;
  }

  async function createList(workspaceId: string): Promise<string> {
    const listId = randomUUID();
    createdListIds.push(listId);
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Checklist" } });
    return listId;
  }

  async function addListLead(listId: string, userId: string): Promise<void> {
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: "LEAD" } });
  }

  // Cascades (Item -> ItemAssignee/Note/PersonalNote, List -> Item) mean
  // the existing List/Workspace teardown below is enough to clean these up
  // too; no separate createdItemIds tracking is needed.
  async function createItem(listId: string, creatorId: string): Promise<string> {
    const itemId = randomUUID();
    await prisma.item.create({ data: { id: itemId, listId, title: "Ship the release notes", creatorId } });
    return itemId;
  }

  function workspaceMembershipExists(workspaceId: string, userId: string) {
    return prisma.workspaceMember
      .findUnique({ where: { workspaceId_userId: { workspaceId, userId } } })
      .then((row) => row !== null);
  }

  try {
    // An Owner can remove an Admin, Member or Viewer who leads no List.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: ownerId,
        workspaceId,
        targetUserId: memberId,
      });

      assert.deepEqual(result, { status: "removed" });
      assert.equal(await workspaceMembershipExists(workspaceId, memberId), false);
    }

    // A Member or Viewer actor is forbidden from removing anyone.
    {
      const workspaceId = await createWorkspace();
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");
      const viewerId = await addWorkspaceMember(workspaceId, "VIEWER");

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: memberId,
        workspaceId,
        targetUserId: viewerId,
      });

      assert.deepEqual(result, { status: "forbidden" });
    }

    // Removing someone who is no longer (or never was) a member fails cleanly.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const strangerId = await createUser();

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: ownerId,
        workspaceId,
        targetUserId: strangerId,
      });

      assert.deepEqual(result, { status: "not-found" });
    }

    // The Owner can never be removed.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const adminId = await addWorkspaceMember(workspaceId, "ADMIN");

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: adminId,
        workspaceId,
        targetUserId: ownerId,
      });

      assert.deepEqual(result, { status: "cannot-remove-owner" });
    }

    // Removal is blocked while the target is the sole Lead of any List; an
    // Owner actor — who has implicit access to every List in the Workspace
    // (ADR 0017) — gets the affected Lists' identities back, and the
    // membership, List role and Guest grant are all left untouched (#98,
    // #91).
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");
      const soleLeadListId = await createList(workspaceId);
      await addListLead(soleLeadListId, memberId);
      const guestListId = await createList(workspaceId);
      await prisma.guest.create({ data: { id: randomUUID(), listId: guestListId, userId: memberId } });

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: ownerId,
        workspaceId,
        targetUserId: memberId,
      });

      assert.deepEqual(result, {
        status: "sole-lead-block",
        count: 1,
        lists: [{ id: soleLeadListId, name: "Checklist" }],
      });
      assert.equal(await workspaceMembershipExists(workspaceId, memberId), true);
      const listRole = await prisma.listMember.findUnique({
        where: { listId_userId: { listId: soleLeadListId, userId: memberId } },
      });
      assert.equal(listRole?.role, "LEAD");
      const guestRow = await prisma.guest.findUnique({
        where: { listId_userId: { listId: guestListId, userId: memberId } },
      });
      assert.ok(guestRow, "a blocked removal must not touch the Guest grant either");
    }

    // The same block for an Admin actor — who has no implicit List access —
    // reports only the count, never the List's identity (#91).
    {
      const workspaceId = await createWorkspace();
      await addWorkspaceMember(workspaceId, "OWNER");
      const adminId = await addWorkspaceMember(workspaceId, "ADMIN");
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");
      const soleLeadListId = await createList(workspaceId);
      await addListLead(soleLeadListId, memberId);

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: adminId,
        workspaceId,
        targetUserId: memberId,
      });

      assert.deepEqual(result, { status: "sole-lead-block", count: 1, lists: [] });
    }

    // An Admin is refused when removing a peer Admin — only the Owner can
    // (#88, #91).
    {
      const workspaceId = await createWorkspace();
      await addWorkspaceMember(workspaceId, "OWNER");
      const adminAId = await addWorkspaceMember(workspaceId, "ADMIN");
      const adminBId = await addWorkspaceMember(workspaceId, "ADMIN");

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: adminAId,
        workspaceId,
        targetUserId: adminBId,
      });

      assert.deepEqual(result, { status: "forbidden" });
      assert.equal(await workspaceMembershipExists(workspaceId, adminBId), true);
    }

    // A Personal Space has nobody to remove.
    {
      const workspaceId = await createWorkspace("PERSONAL");
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const strangerId = await createUser();

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: ownerId,
        workspaceId,
        targetUserId: strangerId,
      });

      assert.deepEqual(result, { status: "forbidden" });
    }

    // Removal clears the target's Item assignments, starred Lists and
    // personal notes in this Workspace, but never touches content they
    // authored — Items and Notes stay, still attributed to them (#91).
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");
      const listId = await createList(workspaceId);
      const itemId = await createItem(listId, memberId);
      await prisma.itemAssignee.create({ data: { id: randomUUID(), itemId, userId: memberId } });
      await prisma.starred.create({ data: { id: randomUUID(), listId, userId: memberId } });
      await prisma.personalNote.create({
        data: { id: randomUUID(), itemId, userId: memberId, body: "Chase this up Monday." },
      });
      const noteId = randomUUID();
      await prisma.note.create({ data: { id: noteId, itemId, authorId: memberId, body: "Shipped the first pass." } });

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: ownerId,
        workspaceId,
        targetUserId: memberId,
      });

      assert.deepEqual(result, { status: "removed" });
      assert.equal(await prisma.itemAssignee.findFirst({ where: { itemId, userId: memberId } }), null);
      assert.equal(await prisma.starred.findFirst({ where: { listId, userId: memberId } }), null);
      assert.equal(await prisma.personalNote.findFirst({ where: { itemId, userId: memberId } }), null);

      const survivingItem = await prisma.item.findUnique({ where: { id: itemId } });
      assert.ok(survivingItem, "the Item the removed member authored must survive");
      assert.equal(survivingItem?.creatorId, memberId, "authorship stays attributed to the removed member");

      const survivingNote = await prisma.note.findUnique({ where: { id: noteId } });
      assert.ok(survivingNote, "the Note the removed member authored must survive");
      assert.equal(survivingNote?.authorId, memberId);
    }

    // Once another Lead exists, removal succeeds and clears the person's
    // List roles and Guest grants in that Workspace so they resolve to no
    // access anywhere in it — a stale row would otherwise both leak access
    // and masquerade as a co-Lead for someone else's sole-Lead check.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");
      const listId = await createList(workspaceId);
      await addListLead(listId, memberId);
      await addListLead(listId, ownerId);
      const guestListId = await createList(workspaceId);
      await prisma.guest.create({ data: { id: randomUUID(), listId: guestListId, userId: memberId } });

      const result = await removeWorkspaceMember(prisma, {
        actingUserId: ownerId,
        workspaceId,
        targetUserId: memberId,
      });

      assert.deepEqual(result, { status: "removed" });
      assert.equal(await workspaceMembershipExists(workspaceId, memberId), false);
      assert.equal(await resolveListAccess(prisma, { userId: memberId, listId }), "NONE");
      assert.equal(
        await resolveListAccess(prisma, { userId: memberId, listId: guestListId }),
        "NONE"
      );
    }

    // Any non-Owner can leave once they lead no List alone.
    {
      const workspaceId = await createWorkspace();
      await addWorkspaceMember(workspaceId, "OWNER");
      const viewerId = await addWorkspaceMember(workspaceId, "VIEWER");

      const result = await leaveWorkspace(prisma, { workspaceId, userId: viewerId });

      assert.deepEqual(result, { status: "left" });
      assert.equal(await workspaceMembershipExists(workspaceId, viewerId), false);
    }

    // The Owner is refused until they transfer ownership first.
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");

      const result = await leaveWorkspace(prisma, { workspaceId, userId: ownerId });

      assert.deepEqual(result, { status: "owner-must-transfer-first" });
      assert.equal(await workspaceMembershipExists(workspaceId, ownerId), true);
    }

    // Leaving is blocked while the person is the sole Lead of a List, then
    // succeeds once a co-Lead is promoted — a handover, not a special case.
    {
      const workspaceId = await createWorkspace();
      const memberId = await addWorkspaceMember(workspaceId, "MEMBER");
      const coworkerId = await addWorkspaceMember(workspaceId, "MEMBER");
      const listId = await createList(workspaceId);
      await addListLead(listId, memberId);

      const blocked = await leaveWorkspace(prisma, { workspaceId, userId: memberId });
      assert.deepEqual(blocked, { status: "sole-lead-block", count: 1 });

      await addListLead(listId, coworkerId);
      const left = await leaveWorkspace(prisma, { workspaceId, userId: memberId });
      assert.deepEqual(left, { status: "left" });
      assert.equal(await resolveListAccess(prisma, { userId: memberId, listId }), "NONE");
    }

    // A Personal Space has nobody to leave.
    {
      const workspaceId = await createWorkspace("PERSONAL");
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");

      const result = await leaveWorkspace(prisma, { workspaceId, userId: ownerId });

      assert.deepEqual(result, { status: "not-found" });
    }

    // Two concurrent exits for a List's last two Leads: exactly one
    // succeeds, the other is told it would strand the List — the List row
    // lock inside lockAndCountSoleLeadLists serializes the two transactions
    // rather than letting both read a stale Lead count (#98, mirroring
    // #95's identical race test for List-level demotion).
    {
      const workspaceId = await createWorkspace();
      const ownerId = await addWorkspaceMember(workspaceId, "OWNER");
      const leadAId = await addWorkspaceMember(workspaceId, "MEMBER");
      const leadBId = await addWorkspaceMember(workspaceId, "MEMBER");
      const listId = await createList(workspaceId);
      await addListLead(listId, leadAId);
      await addListLead(listId, leadBId);

      const [resultA, resultB] = await Promise.all([
        leaveWorkspace(prisma, { workspaceId, userId: leadAId }),
        removeWorkspaceMember(prisma, { actingUserId: ownerId, workspaceId, targetUserId: leadBId }),
      ]);

      const outcomes = [resultA.status, resultB.status].sort();
      assert.deepEqual(outcomes, ["left", "sole-lead-block"]);

      const remainingLeads = await prisma.listMember.count({ where: { listId, role: "LEAD" } });
      assert.equal(remainingLeads, 1, "exactly one Lead must remain");
    }
  } finally {
    await prisma.guest.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: createdListIds } } });
    await prisma.list.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace membership integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
