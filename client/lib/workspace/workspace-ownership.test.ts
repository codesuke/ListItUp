import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createList } from "@/lib/list/list-creation";
import { resolveListAccess } from "@/lib/permissions/list-access";

import { transferWorkspaceOwnership } from "./workspace-ownership";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "workspace ownership test skipped: DATABASE_URL is not set"
    );
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

  async function createWorkspaceWithOwner(): Promise<{
    workspaceId: string;
    ownerId: string;
  }> {
    const workspaceId = randomUUID();
    const ownerId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    createdUserIds.push(ownerId);

    await prisma.user.create({
      data: { id: ownerId, name: "Owner", email: `owner-${randomUUID()}@example.test` },
    });
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team" } });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
    });

    return { workspaceId, ownerId };
  }

  async function addMember(
    workspaceId: string,
    role: "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: "Member", email: `member-${randomUUID()}@example.test` },
    });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });

    return userId;
  }

  async function roleOf(workspaceId: string, userId: string): Promise<string | undefined> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return membership?.role;
  }

  try {
    // The outgoing Owner defaults to ADMIN when no target role is given,
    // and the new Owner ends at OWNER.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const newOwnerId = await addMember(workspaceId, "ADMIN");

      const result = await transferWorkspaceOwnership(prisma, workspaceId, newOwnerId);

      assert.deepEqual(result, { status: "transferred" });
      assert.equal(await roleOf(workspaceId, ownerId), "ADMIN");
      assert.equal(await roleOf(workspaceId, newOwnerId), "OWNER");
    }

    // An explicit outgoing-owner target role is honored.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const newOwnerId = await addMember(workspaceId, "MEMBER");

      const result = await transferWorkspaceOwnership(
        prisma,
        workspaceId,
        newOwnerId,
        "VIEWER"
      );

      assert.deepEqual(result, { status: "transferred" });
      assert.equal(await roleOf(workspaceId, ownerId), "VIEWER");
      assert.equal(await roleOf(workspaceId, newOwnerId), "OWNER");
    }

    // A mid-transaction failure (the new Owner is not yet a member, so the
    // second update fails after the first has already run) must roll back
    // entirely: the original Owner is left intact, never zero- or two-Owner.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const nonMemberUserId = randomUUID();
      createdUserIds.push(nonMemberUserId);
      await prisma.user.create({
        data: {
          id: nonMemberUserId,
          name: "Outsider",
          email: `outsider-${randomUUID()}@example.test`,
        },
      });

      const result = await transferWorkspaceOwnership(
        prisma,
        workspaceId,
        nonMemberUserId
      );

      assert.deepEqual(result, { status: "new-owner-not-a-member" });
      assert.equal(
        await roleOf(workspaceId, ownerId),
        "OWNER",
        "a failed transfer must leave the original Owner's role untouched"
      );
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "OWNER" },
      });
      assert.equal(ownerCount, 1, "exactly one Owner must remain after a failed transfer");
    }

    // After a transfer, the former Owner (now Admin) keeps Lead-level
    // access on Lists they created — via the explicit Lead row
    // createList() wrote for them — and loses access to a List they never
    // joined, since an Admin has no implicit List access (#94, #97).
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const newOwnerId = await addMember(workspaceId, "ADMIN");

      const ownedListResult = await createList(prisma, {
        workspaceId,
        creatorUserId: ownerId,
        name: "Owner's List",
      });
      assert.equal(ownedListResult.status, "created");
      const ownedListId =
        ownedListResult.status === "created" ? ownedListResult.listId : "";

      const unjoinedListResult = await createList(prisma, {
        workspaceId,
        creatorUserId: newOwnerId,
        name: "New Owner's List",
      });
      assert.equal(unjoinedListResult.status, "created");
      const unjoinedListId =
        unjoinedListResult.status === "created" ? unjoinedListResult.listId : "";

      const result = await transferWorkspaceOwnership(prisma, workspaceId, newOwnerId);
      assert.deepEqual(result, { status: "transferred" });
      assert.equal(await roleOf(workspaceId, ownerId), "ADMIN");

      assert.equal(
        await resolveListAccess(prisma, { userId: ownerId, listId: ownedListId }),
        "LEAD",
        "the former Owner keeps Lead on a List they created"
      );
      assert.equal(
        await resolveListAccess(prisma, { userId: ownerId, listId: unjoinedListId }),
        "NONE",
        "the former Owner has no access to a List they never joined"
      );
    }

    // No Owner on the Workspace at all is reported rather than throwing.
    {
      const workspaceId = randomUUID();
      createdWorkspaceIds.push(workspaceId);
      await prisma.workspace.create({ data: { id: workspaceId, name: "Ownerless" } });
      const someUserId = await addMember(workspaceId, "MEMBER");

      const result = await transferWorkspaceOwnership(prisma, workspaceId, someUserId);
      assert.deepEqual(result, { status: "no-current-owner" });
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace ownership test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
