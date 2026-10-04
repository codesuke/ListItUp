import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadWorkspaceSettingsPageData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace settings page smoke test skipped: DATABASE_URL is not set");
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
      data: { id: userId, name, email: `workspace-settings-${userId}@example.test` },
    });
    return userId;
  }

  async function createWorkspace(
    kind: "SHARED" | "PERSONAL",
    name: string
  ): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name, kind } });
    return workspaceId;
  }

  async function addMember(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  ): Promise<void> {
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId, role },
    });
  }

  try {
    // The Owner of a SHARED Workspace sees the page, with every member
    // listed Owner-first, then by role, then alphabetically. viewerRole
    // === "OWNER" is also what makes page.tsx render DeleteWorkspaceForm
    // in the Danger zone (#75) rather than the Owner-only message.
    {
      const workspaceId = await createWorkspace("SHARED", "Launch Team");
      const ownerId = await createUser("Zoe Owner");
      await addMember(workspaceId, ownerId, "OWNER");
      const adminId = await createUser("Amir Admin");
      await addMember(workspaceId, adminId, "ADMIN");
      const memberId = await createUser("Bo Member");
      await addMember(workspaceId, memberId, "MEMBER");

      const data = await loadWorkspaceSettingsPageData(prisma, ownerId, workspaceId);

      assert.ok(data, "expected page data for the Workspace Owner");
      assert.equal(data!.workspaceName, "Launch Team");
      assert.equal(data!.viewerRole, "OWNER");
      assert.deepEqual(
        data!.members.map((member) => member.userId),
        [ownerId, adminId, memberId],
        "members must be ordered Owner, then Admin, then Member/Viewer alphabetically"
      );
    }

    // An Admin also sees the page (Owner+Admin are both management tier),
    // but viewerRole !== "OWNER" is what drives page.tsx to render the
    // Owner-only message instead of TransferOwnershipForm/DeleteWorkspaceForm
    // in both Danger zone blocks.
    {
      const workspaceId = await createWorkspace("SHARED", "Design Guild");
      const ownerId = await createUser("Owner");
      await addMember(workspaceId, ownerId, "OWNER");
      const adminId = await createUser("Admin");
      await addMember(workspaceId, adminId, "ADMIN");

      const data = await loadWorkspaceSettingsPageData(prisma, adminId, workspaceId);

      assert.ok(data, "expected page data for a Workspace Admin");
      assert.equal(data!.viewerRole, "ADMIN");
    }

    // A Member (and by the same rule, a Viewer) gets no page data at all —
    // the page renders notFound() for both, per #58.
    {
      const workspaceId = await createWorkspace("SHARED", "Member Only Co");
      const ownerId = await createUser("Owner");
      await addMember(workspaceId, ownerId, "OWNER");
      const memberId = await createUser("Member");
      await addMember(workspaceId, memberId, "MEMBER");

      const data = await loadWorkspaceSettingsPageData(prisma, memberId, workspaceId);

      assert.equal(data, null);
    }

    // A Personal Space's sole Owner also gets no page data — there is
    // nothing to manage there (#58 settled this as SHARED-only).
    {
      const workspaceId = await createWorkspace("PERSONAL", "Personal Space");
      const ownerId = await createUser("Solo Owner");
      await addMember(workspaceId, ownerId, "OWNER");

      const data = await loadWorkspaceSettingsPageData(prisma, ownerId, workspaceId);

      assert.equal(data, null);
    }

    // A User with no relationship to the Workspace at all gets no page
    // data either.
    {
      const workspaceId = await createWorkspace("SHARED", "Outsider Test");
      const strangerId = await createUser("Stranger");

      const data = await loadWorkspaceSettingsPageData(prisma, strangerId, workspaceId);

      assert.equal(data, null);
    }
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: createdWorkspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace settings page smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
