import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { browseLists } from "./list-browsing";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("list visibility cross-check integration test skipped: DATABASE_URL is not set");
    return;
  }

  const [{ PrismaPg }, { PrismaClient }, { resolveListAccess, meetsListAccessLevel }, { globalSearch }] =
    await Promise.all([
      import("@prisma/adapter-pg"),
      import("@/generated/prisma/client"),
      import("@/lib/permissions/list-access"),
      import("@/lib/search/global-search"),
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
      data: { id: userId, name: "Test User", email: `visibility-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name: "Test Workspace" } });
    return workspaceId;
  }

  // browseLists/globalSearch agreeing with resolveListAccess's per-row
  // answer (#106, ADR 0019) is only meaningful for a scenario that scopes
  // to one List per Workspace, so a mismatch shows up as that List being
  // wrongly included/excluded rather than drowned out by siblings.
  type Scenario = {
    name: string;
    workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | null;
    listRole: "LEAD" | "MEMBER" | "VIEWER" | null;
    isGuest: boolean;
    deleted: boolean;
  };

  const SCENARIOS: Scenario[] = [
    { name: "Owner, no explicit List role", workspaceRole: "OWNER", listRole: null, isGuest: false, deleted: false },
    { name: "Admin, no explicit List role", workspaceRole: "ADMIN", listRole: null, isGuest: false, deleted: false },
    { name: "Admin, explicit List Lead", workspaceRole: "ADMIN", listRole: "LEAD", isGuest: false, deleted: false },
    { name: "Member, explicit List Member", workspaceRole: "MEMBER", listRole: "MEMBER", isGuest: false, deleted: false },
    { name: "Member, no explicit List role", workspaceRole: "MEMBER", listRole: null, isGuest: false, deleted: false },
    { name: "Workspace Viewer ceiling over List Lead", workspaceRole: "VIEWER", listRole: "LEAD", isGuest: false, deleted: false },
    { name: "Guest grant, no Workspace membership", workspaceRole: null, listRole: null, isGuest: true, deleted: false },
    { name: "Stranger: no Workspace or List relationship", workspaceRole: null, listRole: null, isGuest: false, deleted: false },
    { name: "Deleted Workspace, Owner", workspaceRole: "OWNER", listRole: null, isGuest: false, deleted: true },
    { name: "Deleted Workspace, Guest grant", workspaceRole: null, listRole: null, isGuest: true, deleted: true },
  ];

  try {
    for (const scenario of SCENARIOS) {
      const workspaceId = await createWorkspace();
      const userId = await createUser();
      const listName = `Scenario ${randomUUID()}`;
      const listId = randomUUID();
      await prisma.list.create({ data: { id: listId, workspaceId, name: listName } });

      if (scenario.workspaceRole) {
        await prisma.workspaceMember.create({
          data: { id: randomUUID(), workspaceId, userId, role: scenario.workspaceRole },
        });
      }
      if (scenario.listRole) {
        await prisma.listMember.create({ data: { id: randomUUID(), listId, userId, role: scenario.listRole } });
      }
      if (scenario.isGuest) {
        await prisma.guest.create({ data: { id: randomUUID(), listId, userId } });
      }
      if (scenario.deleted) {
        await prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });
      }

      const access = await resolveListAccess(prisma, { userId, listId });
      const expectedVisible = meetsListAccessLevel(access, "READ");

      const browsed = await browseLists(prisma, { userId, workspaceId });
      const browseVisible = browsed.some((list) => list.id === listId);
      assert.equal(
        browseVisible,
        expectedVisible,
        `browseLists disagreed with resolveListAccess (${access}) for: ${scenario.name}`
      );

      // globalSearch's sole authorization gate is holding a WorkspaceMember
      // row at all (#56, #70) — a Guest is never meant to reach the header
      // palette in the first place, so it can't agree with resolveListAccess
      // for a Guest-only scenario the way browseLists does. The cross-check
      // is scoped to actual Workspace members, where the two must agree.
      if (scenario.workspaceRole) {
        const searched = await globalSearch(prisma, { userId, workspaceId, query: listName });
        const searchVisible = searched.lists.some((list) => list.id === listId);
        assert.equal(
          searchVisible,
          expectedVisible,
          `globalSearch disagreed with resolveListAccess (${access}) for: ${scenario.name}`
        );
      }
    }
  } finally {
    const listIds = (
      await prisma.list.findMany({ where: { workspaceId: { in: createdWorkspaceIds } } })
    ).map((list) => list.id);
    await prisma.guest.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listMember.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: createdWorkspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("list visibility cross-check integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
