import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { deleteAccount } from "./account-deletion";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("account deletion test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name: "User", email: `user-${randomUUID()}@example.test` },
    });
    return userId;
  }

  async function createWorkspaceWithOwner(ownerId: string): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team" } });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
    });
    return workspaceId;
  }

  async function addMember(workspaceId: string, userId: string): Promise<void> {
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role: "MEMBER" },
    });
  }

  async function addList(
    workspaceId: string,
    members: Array<{ userId: string; role: "LEAD" | "MEMBER" | "VIEWER" }>
  ): Promise<string> {
    const listId = randomUUID();
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Checklist" } });
    for (const { userId, role } of members) {
      await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role } });
    }
    return listId;
  }

  async function userExists(userId: string): Promise<boolean> {
    return (await prisma.user.findUnique({ where: { id: userId } })) !== null;
  }

  try {
    // A User with no List Lead rows at all can delete their account.
    {
      const userId = await createUser();

      const result = await deleteAccount(prisma, { userId });

      assert.deepEqual(result, { status: "deleted" });
      assert.equal(await userExists(userId), false);
      createdUserIds.splice(createdUserIds.indexOf(userId), 1);
    }

    // Deletion is blocked while the User is the sole Lead of a List, and
    // reports the blocking count instead of deleting the account.
    {
      const ownerId = await createUser();
      const memberId = await createUser();
      const workspaceId = await createWorkspaceWithOwner(ownerId);
      await addMember(workspaceId, memberId);
      const soleLeadListId = await addList(workspaceId, [{ userId: memberId, role: "LEAD" }]);

      const result = await deleteAccount(prisma, { userId: memberId });

      assert.deepEqual(result, { status: "sole-lead-block", count: 1 });
      assert.equal(await userExists(memberId), true);
      assert.equal(
        (await prisma.listMember.findUnique({
          where: { listId_userId: { listId: soleLeadListId, userId: memberId } },
        }))?.role,
        "LEAD"
      );
    }

    // Deletion succeeds once another Lead covers every List the User leads.
    {
      const ownerId = await createUser();
      const memberId = await createUser();
      const workspaceId = await createWorkspaceWithOwner(ownerId);
      await addMember(workspaceId, memberId);
      await addList(workspaceId, [
        { userId: memberId, role: "LEAD" },
        { userId: ownerId, role: "LEAD" },
      ]);

      const result = await deleteAccount(prisma, { userId: memberId });

      assert.deepEqual(result, { status: "deleted" });
      assert.equal(await userExists(memberId), false);
      createdUserIds.splice(createdUserIds.indexOf(memberId), 1);
    }

    // Being the sole Lead of two Lists, in two different Workspaces, reports
    // a count of two — the block spans every Workspace the User belongs to,
    // not just one.
    {
      const ownerId = await createUser();
      const memberId = await createUser();
      const workspaceOneId = await createWorkspaceWithOwner(ownerId);
      const workspaceTwoId = await createWorkspaceWithOwner(ownerId);
      await addMember(workspaceOneId, memberId);
      await addMember(workspaceTwoId, memberId);
      await addList(workspaceOneId, [{ userId: memberId, role: "LEAD" }]);
      await addList(workspaceTwoId, [{ userId: memberId, role: "LEAD" }]);

      const result = await deleteAccount(prisma, { userId: memberId });

      assert.deepEqual(result, { status: "sole-lead-block", count: 2 });
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("account deletion test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
