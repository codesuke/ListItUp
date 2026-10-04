import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { renameWorkspace } from "./workspace-rename";
import { WORKSPACE_NAME_MAX_LENGTH } from "./workspace-creation";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("workspace rename test skipped: DATABASE_URL is not set");
    return;
  }

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const createdWorkspaceIds: string[] = [];

  async function createWorkspace(name: string): Promise<string> {
    const workspaceId = randomUUID();
    createdWorkspaceIds.push(workspaceId);
    await prisma.workspace.create({ data: { id: workspaceId, name } });
    return workspaceId;
  }

  async function nameOf(workspaceId: string): Promise<string> {
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    return workspace.name;
  }

  try {
    // A trimmed, valid name replaces the Workspace's current name.
    {
      const workspaceId = await createWorkspace("Launch Team");

      const result = await renameWorkspace(prisma, workspaceId, "  Rocket Squad  ");

      assert.deepEqual(result, { status: "renamed", name: "Rocket Squad" });
      assert.equal(await nameOf(workspaceId), "Rocket Squad");
    }

    // A blank (or all-whitespace) name is rejected without touching the row.
    {
      const workspaceId = await createWorkspace("Launch Team");

      const result = await renameWorkspace(prisma, workspaceId, "   ");

      assert.deepEqual(result, { status: "invalid-name", reason: "empty" });
      assert.equal(await nameOf(workspaceId), "Launch Team");
    }

    // A name past the shared max length is rejected the same way
    // createWorkspace enforces it, without touching the row.
    {
      const workspaceId = await createWorkspace("Launch Team");
      const tooLong = "x".repeat(WORKSPACE_NAME_MAX_LENGTH + 1);

      const result = await renameWorkspace(prisma, workspaceId, tooLong);

      assert.deepEqual(result, { status: "invalid-name", reason: "too-long" });
      assert.equal(await nameOf(workspaceId), "Launch Team");
    }
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.$disconnect();
  }

  console.log("workspace rename test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
