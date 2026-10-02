import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createWorkspace,
  WORKSPACE_NAME_MAX_LENGTH,
} from "./workspace-creation";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "workspace creation integration test skipped: DATABASE_URL is not set"
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

  async function createUser(emailVerified: boolean): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: {
        id: userId,
        name: "Workspace creation test user",
        email: `workspace-creation-${userId}@example.test`,
        emailVerified,
      },
    });
    return userId;
  }

  async function workspacesCreatedBy(userId: string) {
    return prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: { members: true, lists: true },
    });
  }

  try {
    // A verified User gets a trimmed-name, non-Demo SHARED Workspace they
    // solely own, with no Lists (the Inbox belongs to the Personal Space).
    {
      const userId = await createUser(true);
      const result = await createWorkspace(prisma, userId, "  Launch Team  ");

      assert.equal(result.status, "created");
      assert.ok(result.status === "created");
      createdWorkspaceIds.push(result.workspaceId);

      const [workspace, ...rest] = await workspacesCreatedBy(userId);
      assert.equal(rest.length, 0);
      assert.equal(workspace.id, result.workspaceId);
      assert.equal(workspace.name, "Launch Team");
      assert.equal(workspace.kind, "SHARED");
      assert.equal(workspace.isDemo, false);
      assert.equal(workspace.peerComparisonEnabled, false);
      assert.equal(workspace.lists.length, 0, "a new Workspace starts with no Lists");
      assert.equal(workspace.members.length, 1);
      assert.equal(workspace.members[0].userId, userId);
      assert.equal(workspace.members[0].role, "OWNER");
    }

    // The new Workspace is visible to its creator's switcher query and to
    // no one else's.
    {
      const creatorId = await createUser(true);
      const strangerId = await createUser(true);
      const result = await createWorkspace(prisma, creatorId, "Private Crew");
      assert.ok(result.status === "created");
      createdWorkspaceIds.push(result.workspaceId);

      const switcherFor = (userId: string) =>
        prisma.workspaceMember.findMany({
          where: { userId, workspace: { kind: "SHARED" } },
        });

      assert.ok(
        (await switcherFor(creatorId)).some(
          (member) => member.workspaceId === result.workspaceId
        )
      );
      assert.equal((await switcherFor(strangerId)).length, 0);
    }

    // Invalid names are rejected and create nothing.
    {
      const userId = await createUser(true);

      assert.deepEqual(await createWorkspace(prisma, userId, ""), {
        status: "invalid-name",
        reason: "empty",
      });
      assert.deepEqual(await createWorkspace(prisma, userId, "   \n\t "), {
        status: "invalid-name",
        reason: "empty",
      });
      assert.deepEqual(
        await createWorkspace(
          prisma,
          userId,
          "x".repeat(WORKSPACE_NAME_MAX_LENGTH + 1)
        ),
        { status: "invalid-name", reason: "too-long" }
      );
      assert.deepEqual(await workspacesCreatedBy(userId), []);

      const atLimit = await createWorkspace(
        prisma,
        userId,
        "x".repeat(WORKSPACE_NAME_MAX_LENGTH)
      );
      assert.ok(atLimit.status === "created", "a name at the limit is allowed");
      createdWorkspaceIds.push(atLimit.workspaceId);
    }

    // Unknown and unverified Users are rejected and create nothing.
    {
      const unverifiedId = await createUser(false);

      assert.deepEqual(await createWorkspace(prisma, unverifiedId, "Nope"), {
        status: "user-not-verified",
      });
      assert.deepEqual(await createWorkspace(prisma, randomUUID(), "Nope"), {
        status: "user-not-verified",
      });
      assert.deepEqual(await workspacesCreatedBy(unverifiedId), []);
    }

    // The same name can be used twice; the Workspaces stay distinct.
    {
      const userId = await createUser(true);
      const first = await createWorkspace(prisma, userId, "Twins");
      const second = await createWorkspace(prisma, userId, "Twins");

      assert.ok(first.status === "created" && second.status === "created");
      createdWorkspaceIds.push(first.workspaceId, second.workspaceId);
      assert.notEqual(first.workspaceId, second.workspaceId);
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: createdWorkspaceIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
