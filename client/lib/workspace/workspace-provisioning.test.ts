import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  INBOX_LIST_NAME,
  PERSONAL_WORKSPACE_NAME,
} from "@/lib/auth/auth-config";
import { provisionPersonalWorkspace } from "./workspace-provisioning";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "workspace provisioning integration test skipped: DATABASE_URL is not set"
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
  const userId = randomUUID();
  const email = `workspace-provisioning-${userId}@example.test`;

  try {
    const unverifiedUser = await prisma.user.create({
      data: {
        id: userId,
        name: "Provisioning test user",
        email,
        emailVerified: false,
      },
    });

    await provisionPersonalWorkspace(prisma, unverifiedUser.id);
    const workspaceForUnverifiedUser = await prisma.workspace.findUnique({
      where: { ownerId: unverifiedUser.id },
    });
    assert.equal(
      workspaceForUnverifiedUser,
      null,
      "an unverified user must not receive a personal Workspace"
    );

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    await provisionPersonalWorkspace(prisma, userId);
    await provisionPersonalWorkspace(prisma, userId);

    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: userId },
      include: { lists: true },
    });

    assert.equal(
      workspaces.length,
      1,
      "provisioning twice must not create a second personal Workspace"
    );
    assert.equal(workspaces[0].name, PERSONAL_WORKSPACE_NAME);
    assert.equal(workspaces[0].lists.length, 1);
    assert.equal(workspaces[0].lists[0].name, INBOX_LIST_NAME);
    assert.equal(workspaces[0].lists[0].isInbox, true);
  } finally {
    await prisma.workspace.deleteMany({ where: { ownerId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }

  console.log("workspace provisioning integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
