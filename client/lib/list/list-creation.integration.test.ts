import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createList } from "./list-creation";
import { removeListMember } from "./list-membership";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list creation integration test skipped: DATABASE_URL is not set");
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

  async function createWorkspaceWithMember(
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<{ workspaceId: string; memberId: string }> {
    const workspaceId = randomUUID();
    const memberId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    createdUserIds.push(memberId);

    await prisma.user.create({
      data: { id: memberId, name: "Member", email: `member-${randomUUID()}@example.test` },
    });
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team" } });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: memberId, role },
    });

    return { workspaceId, memberId };
  }

  async function addWorkspaceMember(
    workspaceId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: "Bystander", email: `bystander-${randomUUID()}@example.test` },
    });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });

    return userId;
  }

  try {
    // The creator becomes the List's first Lead, and no other Workspace
    // Member gets implicit access from that.
    {
      const { workspaceId, memberId: creatorId } = await createWorkspaceWithMember("OWNER");
      const bystanderId = await addWorkspaceMember(workspaceId, "MEMBER");

      const result = await createList(prisma, {
        workspaceId,
        creatorUserId: creatorId,
        name: "Launch Checklist",
      });

      assert.equal(result.status, "created");
      const listId = result.status === "created" ? result.listId : undefined;
      assert.ok(listId);

      const members = await prisma.listMember.findMany({ where: { listId } });
      assert.equal(members.length, 1, "only the creator gets a ListMember row");
      assert.equal(members[0].userId, creatorId);
      assert.equal(members[0].role, "LEAD");

      const bystanderMembership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId: listId!, userId: bystanderId } },
      });
      assert.equal(
        bystanderMembership,
        null,
        "another Workspace Member must not gain implicit List access"
      );
    }

    // A User with no Workspace-level membership cannot create a List in
    // that Workspace.
    {
      const workspaceId = randomUUID();
      createdWorkspaceIds.push(workspaceId);
      await prisma.workspace.create({ data: { id: workspaceId, name: "Outsider Test" } });
      const outsiderId = randomUUID();
      createdUserIds.push(outsiderId);
      await prisma.user.create({
        data: { id: outsiderId, name: "Outsider", email: `outsider-${randomUUID()}@example.test` },
      });

      const result = await createList(prisma, {
        workspaceId,
        creatorUserId: outsiderId,
        name: "Should not exist",
      });

      assert.deepEqual(result, { status: "creator-lacks-workspace-membership" });
      const lists = await prisma.list.findMany({ where: { workspaceId } });
      assert.equal(lists.length, 0, "no List must be created when the creator lacks Workspace membership");
    }

    // A Workspace Admin can also create a List.
    {
      const { workspaceId, memberId: adminId } = await createWorkspaceWithMember("ADMIN");

      const result = await createList(prisma, {
        workspaceId,
        creatorUserId: adminId,
        name: "Admin-created List",
      });

      assert.equal(result.status, "created");
    }

    // A Workspace Member without Admin/Owner rights cannot create a List
    // (ADR 0009): List creation stays restricted even though the User does
    // belong to the Workspace.
    {
      const { workspaceId, memberId } = await createWorkspaceWithMember("MEMBER");

      const result = await createList(prisma, {
        workspaceId,
        creatorUserId: memberId,
        name: "Should not exist",
      });

      assert.deepEqual(result, { status: "creator-lacks-required-role" });
      const lists = await prisma.list.findMany({ where: { workspaceId } });
      assert.equal(lists.length, 0, "no List must be created when the creator lacks the required role");
    }

    // A Workspace Viewer cannot create a List either.
    {
      const { workspaceId, memberId: viewerId } = await createWorkspaceWithMember("VIEWER");

      const result = await createList(prisma, {
        workspaceId,
        creatorUserId: viewerId,
        name: "Should not exist",
      });

      assert.deepEqual(result, { status: "creator-lacks-required-role" });
    }

    // The creator's explicit Lead row is immediately subject to the
    // never-zero-Leads invariant: a freshly created List's creator can't be
    // removed from it, since they're its only Lead (#95).
    {
      const { workspaceId, memberId: creatorId } = await createWorkspaceWithMember("OWNER");

      const created = await createList(prisma, {
        workspaceId,
        creatorUserId: creatorId,
        name: "Launch Checklist",
      });
      assert.equal(created.status, "created");
      const listId = created.status === "created" ? created.listId : undefined;
      assert.ok(listId);

      const result = await removeListMember(prisma, { actorUserId: creatorId, listId: listId!, userId: creatorId });

      assert.deepEqual(result, { status: "last-lead" });
      const membership = await prisma.listMember.findUnique({
        where: { listId_userId: { listId: listId!, userId: creatorId } },
      });
      assert.equal(membership?.role, "LEAD", "the creator must remain the List's Lead");
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list creation integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
