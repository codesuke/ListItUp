import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { DEMO_TEAMMATES, DEMO_WORKSPACE_NAME, provisionDemoWorkspace } from "./demo-workspace";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("demo workspace integration test skipped: DATABASE_URL is not set");
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

  async function createUser(emailVerified: boolean, email?: string) {
    const id = randomUUID();
    createdUserIds.push(id);
    await prisma.user.create({
      data: {
        id,
        name: "Demo workspace test user",
        email: email ?? `demo-workspace-${id}@example.test`,
        emailVerified,
      },
    });
    return id;
  }

  async function demoWorkspacesFor(userId: string) {
    return prisma.workspace.findMany({
      where: { isDemo: true, members: { some: { userId } } },
      include: { lists: { include: { items: true } }, members: true },
    });
  }

  // The shared maya.chen@example.com/owen.park@example.com fixture Users
  // persist across test runs by design (every Demo Workspace upserts
  // them). If a prior run crashed after making one of them a Demo
  // Workspace OWNER but before this file's own cleanup ran, that leftover
  // Workspace would make this run's "collision" case see them as already
  // provisioned — reset that sliver of shared state up front so the test
  // is self-healing rather than requiring manual DB cleanup.
  async function resetSharedFixtureOwnership() {
    const fixtureTeammates = await prisma.user.findMany({
      where: { email: { in: DEMO_TEAMMATES.map((t) => t.email) } },
      select: { id: true },
    });
    const fixtureIds = fixtureTeammates.map((t) => t.id);
    if (fixtureIds.length === 0) {
      return;
    }
    const ownedDemoWorkspaces = await prisma.workspace.findMany({
      where: { isDemo: true, members: { some: { userId: { in: fixtureIds }, role: "OWNER" } } },
      select: { id: true },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: ownedDemoWorkspaces.map((w) => w.id) } } });
    await prisma.mutedNotificationType.deleteMany({ where: { userId: { in: fixtureIds } } });
  }
  await resetSharedFixtureOwnership();

  try {
    const unverifiedUserId = await createUser(false);
    const unverifiedResult = await provisionDemoWorkspace(prisma, unverifiedUserId);
    assert.equal(unverifiedResult, "not_eligible");
    assert.deepEqual(await demoWorkspacesFor(unverifiedUserId), []);

    const userId = await createUser(true);
    const firstResult = await provisionDemoWorkspace(prisma, userId);
    const secondResult = await provisionDemoWorkspace(prisma, userId);

    assert.equal(firstResult, "created");
    assert.equal(secondResult, "already_provisioned");

    const workspaces = await demoWorkspacesFor(userId);
    assert.equal(workspaces.length, 1, "provisioning twice must not create a second Demo Workspace");
    const workspace = workspaces[0];
    assert.equal(workspace.name, DEMO_WORKSPACE_NAME);
    assert.equal(workspace.kind, "SHARED");
    assert.equal(workspace.isDemo, true);
    assert.equal(workspace.members.find((m) => m.userId === userId)?.role, "OWNER");
    assert.ok(workspace.lists.length >= 2, "Demo Workspace should ship with more than one List");
    const totalItems = workspace.lists.reduce((sum, list) => sum + list.items.length, 0);
    assert.ok(totalItems > 0, "Demo Workspace Lists should contain seeded Items");

    // A registered user whose id happens to collide with one of the Demo
    // Workspace's fixture teammates (e.g. that teammate's own real account)
    // must not crash the unique (workspaceId, userId) constraint by being
    // added as both the Workspace's owner and one of its seeded members.
    // `maya` was upserted as a real User by the call above, so re-use her
    // id rather than a synthetic one.
    const maya = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_TEAMMATES[0].email } });
    const mayaId = maya.id;
    const collidingResult = await provisionDemoWorkspace(prisma, mayaId);
    assert.equal(collidingResult, "created");
    const collidingWorkspace = await prisma.workspace.findFirstOrThrow({
      where: { isDemo: true, members: { some: { userId: mayaId, role: "OWNER" } } },
      include: { members: true },
    });
    const memberUserIds = collidingWorkspace.members.map((m) => m.userId);
    assert.equal(
      new Set(memberUserIds).size,
      memberUserIds.length,
      "a colliding fixture teammate must be deduplicated, not added twice"
    );
    await prisma.workspace.delete({ where: { id: collidingWorkspace.id } });
    // mutedNotificationType is keyed by userId, not workspaceId, so it
    // isn't cascade-deleted with the Workspace above — clean it up
    // explicitly to leave the shared maya.chen@example.com fixture User
    // exactly as this test found her, for repeatable re-runs.
    await prisma.mutedNotificationType.deleteMany({ where: { userId: mayaId, type: "ASSIGNEE_REMOVED" } });

    // Some existing Users manually ran the old seed-demo-data.ts script
    // before Demo Workspaces existed as a concept, and already own a
    // SHARED Workspace named DEMO_WORKSPACE_NAME with isDemo still false.
    // Backfilling them must adopt that Workspace in place rather than
    // create a duplicate alongside it.
    const preExistingOwnerId = await createUser(true);
    const preExistingWorkspace = await prisma.workspace.create({
      data: {
        id: randomUUID(),
        name: DEMO_WORKSPACE_NAME,
        kind: "SHARED",
        members: { create: [{ id: randomUUID(), userId: preExistingOwnerId, role: "OWNER" }] },
        lists: { create: [{ id: randomUUID(), name: "Pre-existing List" }] },
      },
    });
    const adoptResult = await provisionDemoWorkspace(prisma, preExistingOwnerId);
    assert.equal(adoptResult, "adopted");
    const workspacesAfterAdoption = await demoWorkspacesFor(preExistingOwnerId);
    assert.equal(workspacesAfterAdoption.length, 1, "adoption must not create a duplicate Workspace");
    assert.equal(workspacesAfterAdoption[0].id, preExistingWorkspace.id, "adoption must reuse the existing Workspace");
    assert.equal(workspacesAfterAdoption[0].isDemo, true);
    assert.deepEqual(
      workspacesAfterAdoption[0].lists.map((l) => l.name),
      ["Pre-existing List"],
      "adoption must not overwrite the Workspace's existing Lists"
    );
  } finally {
    const allDemoWorkspaces = await prisma.workspace.findMany({
      where: { isDemo: true, members: { some: { userId: { in: createdUserIds } } } },
      select: { id: true },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: allDemoWorkspaces.map((w) => w.id) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("demo workspace integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
