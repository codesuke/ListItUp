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

  async function createWorkspaceWithOwner(
    kind: "SHARED" | "PERSONAL" = "SHARED"
  ): Promise<{ workspaceId: string; ownerId: string }> {
    const workspaceId = randomUUID();
    const ownerId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    createdUserIds.push(ownerId);

    await prisma.user.create({
      data: { id: ownerId, name: "Owner", email: `owner-${randomUUID()}@example.test` },
    });
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team", kind } });
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

  async function ownerCountOf(workspaceId: string): Promise<number> {
    return prisma.workspaceMember.count({ where: { workspaceId, role: "OWNER" } });
  }

  try {
    // A successful transfer: the outgoing Owner lands on Admin, the new
    // Owner (an existing Admin) ends at Owner.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const newOwnerId = await addMember(workspaceId, "ADMIN");

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: newOwnerId,
      });

      assert.deepEqual(result, { status: "transferred" });
      assert.equal(await roleOf(workspaceId, ownerId), "ADMIN");
      assert.equal(await roleOf(workspaceId, newOwnerId), "OWNER");
      assert.equal(await ownerCountOf(workspaceId), 1);
    }

    // An existing Member is just as eligible as an Admin.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const newOwnerId = await addMember(workspaceId, "MEMBER");

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: newOwnerId,
      });

      assert.deepEqual(result, { status: "transferred" });
      assert.equal(await roleOf(workspaceId, ownerId), "ADMIN");
      assert.equal(await roleOf(workspaceId, newOwnerId), "OWNER");
      assert.equal(await ownerCountOf(workspaceId), 1);
    }

    // A non-Owner actor (here, the intended new Owner itself) calling the
    // transfer directly is refused — the authority check lives in the
    // operation, not only in the Settings Server Action that gates it today.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const adminId = await addMember(workspaceId, "ADMIN");

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: adminId,
        newOwnerUserId: ownerId,
      });

      assert.deepEqual(result, { status: "not-owner" });
      assert.equal(await roleOf(workspaceId, ownerId), "OWNER");
      assert.equal(await roleOf(workspaceId, adminId), "ADMIN");
    }

    // A Viewer can never become Owner.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const viewerId = await addMember(workspaceId, "VIEWER");

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: viewerId,
      });

      assert.deepEqual(result, { status: "new-owner-ineligible" });
      assert.equal(await roleOf(workspaceId, ownerId), "OWNER");
      assert.equal(await roleOf(workspaceId, viewerId), "VIEWER");
    }

    // "Transferring" to the current Owner is refused rather than silently
    // no-op'd.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: ownerId,
      });

      assert.deepEqual(result, { status: "new-owner-ineligible" });
      assert.equal(await roleOf(workspaceId, ownerId), "OWNER");
    }

    // A Personal Space has nothing to transfer.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner("PERSONAL");
      const memberId = await addMember(workspaceId, "ADMIN");

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: memberId,
      });

      assert.deepEqual(result, { status: "personal-space" });
      assert.equal(await roleOf(workspaceId, ownerId), "OWNER");
    }

    // A deleted Workspace stays frozen.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const memberId = await addMember(workspaceId, "ADMIN");
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: new Date(), deletedByUserId: ownerId },
      });

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: memberId,
      });

      assert.deepEqual(result, { status: "workspace-deleted" });
      assert.equal(await roleOf(workspaceId, ownerId), "OWNER");
    }

    // A mid-transaction failure (the new Owner is not a member at all) must
    // roll back entirely: the original Owner is left intact, never zero- or
    // two-Owner.
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

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: nonMemberUserId,
      });

      assert.deepEqual(result, { status: "new-owner-not-a-member" });
      assert.equal(
        await roleOf(workspaceId, ownerId),
        "OWNER",
        "a failed transfer must leave the original Owner's role untouched"
      );
      assert.equal(
        await ownerCountOf(workspaceId),
        1,
        "exactly one Owner must remain after a failed transfer"
      );
    }

    // Two concurrent transfers against the same Workspace must never leave
    // two Owners: the current Owner is identified from the acting User's own
    // membership row, locked via the Workspace row, so the second transfer
    // to commit finds the acting User already demoted to Admin.
    {
      const { workspaceId, ownerId } = await createWorkspaceWithOwner();
      const candidateAId = await addMember(workspaceId, "ADMIN");
      const candidateBId = await addMember(workspaceId, "MEMBER");

      const [resultA, resultB] = await Promise.all([
        transferWorkspaceOwnership(prisma, {
          workspaceId,
          actingUserId: ownerId,
          newOwnerUserId: candidateAId,
        }),
        transferWorkspaceOwnership(prisma, {
          workspaceId,
          actingUserId: ownerId,
          newOwnerUserId: candidateBId,
        }),
      ]);

      const statuses = [resultA.status, resultB.status].sort();
      assert.deepEqual(
        statuses,
        ["not-owner", "transferred"],
        "exactly one concurrent transfer succeeds; the other finds the acting User no longer Owner"
      );

      assert.equal(
        await ownerCountOf(workspaceId),
        1,
        "exactly one Owner must remain after concurrent transfers"
      );
      assert.equal(await roleOf(workspaceId, ownerId), "ADMIN");
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

      const result = await transferWorkspaceOwnership(prisma, {
        workspaceId,
        actingUserId: ownerId,
        newOwnerUserId: newOwnerId,
      });
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
