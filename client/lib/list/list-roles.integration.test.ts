import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getListRoles } from "./list-roles";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list roles integration test skipped: DATABASE_URL is not set");
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

  async function createUser(name: string): Promise<string> {
    const userId = randomUUID();
    createdUserIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name, email: `list-roles-${userId}@example.test` },
    });
    return userId;
  }

  try {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });

    const listId = randomUUID();
    await prisma.list.create({ data: { id: listId, workspaceId, name: "Test List" } });

    const leadId = await createUser("Lana Lead");
    const memberId = await createUser("Mo Member");
    const viewerId = await createUser("Vic Viewer");

    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: leadId, role: "LEAD" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: memberId, role: "MEMBER" } });
    await prisma.listMember.create({ data: { id: randomUUID(), listId, userId: viewerId, role: "VIEWER" } });

    const roles = await getListRoles(prisma, { listId });

    assert.deepEqual(roles.leads.map((r) => r.userId), [leadId]);
    assert.deepEqual(roles.members.map((r) => r.userId), [memberId]);
    assert.deepEqual(roles.viewers.map((r) => r.userId), [viewerId]);
    assert.equal(roles.leads[0].name, "Lana Lead");

    // An empty List has no roles in any bucket.
    const emptyListId = randomUUID();
    await prisma.list.create({ data: { id: emptyListId, workspaceId, name: "Empty List" } });
    const emptyRoles = await getListRoles(prisma, { listId: emptyListId });
    assert.deepEqual(emptyRoles, { leads: [], members: [], viewers: [] });
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list roles integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
