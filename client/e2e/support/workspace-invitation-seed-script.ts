import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client";

const INVITATION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface SeedPayload {
  email: string;
  role: "MEMBER" | "VIEWER";
}

interface CleanupPayload {
  workspaceId: string;
  ownerId: string;
  invitedUserEmails: string[];
}

async function seedInvitation(prisma: PrismaClient, payload: SeedPayload) {
  const workspaceId = randomUUID();
  const ownerId = randomUUID();
  const workspaceName = `Browser Test Workspace ${randomUUID()}`;
  const token = randomUUID();

  await prisma.user.create({
    data: {
      id: ownerId,
      name: "Workspace owner",
      email: `owner-${randomUUID()}@example.test`,
    },
  });
  await prisma.workspace.create({
    data: { id: workspaceId, name: workspaceName },
  });
  await prisma.workspaceMember.create({
    data: { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
  });
  await prisma.workspaceInvitation.create({
    data: {
      id: randomUUID(),
      workspaceId,
      email: payload.email,
      role: payload.role,
      token,
      expiresAt: new Date(Date.now() + INVITATION_EXPIRES_IN_MS),
    },
  });

  return { token, workspaceId, workspaceName, ownerId };
}

async function cleanupInvitation(prisma: PrismaClient, payload: CleanupPayload) {
  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: payload.workspaceId },
  });
  await prisma.workspaceInvitation.deleteMany({
    where: { workspaceId: payload.workspaceId },
  });
  await prisma.workspace.deleteMany({ where: { id: payload.workspaceId } });
  // Signing in also auto-provisions a Personal Space and a Demo Workspace
  // (lib/auth/auth-core.ts's session.create hook) — delete those too so
  // hard-deleting the invitee below doesn't hit Item's immutable
  // creatorId foreign key.
  await prisma.workspace.deleteMany({
    where: {
      members: {
        some: {
          user: { email: { in: payload.invitedUserEmails } },
          role: "OWNER",
        },
      },
    },
  });
  await prisma.user.deleteMany({
    where: { email: { in: payload.invitedUserEmails } },
  });
  await prisma.user
    .delete({ where: { id: payload.ownerId } })
    .catch(() => undefined);

  return { ok: true };
}

async function main() {
  const [, , command, payloadJson] = process.argv;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set for browser tests that seed data directly."
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const payload: unknown = JSON.parse(payloadJson ?? "{}");

    if (command === "seed-invitation") {
      process.stdout.write(
        JSON.stringify(await seedInvitation(prisma, payload as SeedPayload))
      );
      return;
    }

    if (command === "cleanup-invitation") {
      process.stdout.write(
        JSON.stringify(
          await cleanupInvitation(prisma, payload as CleanupPayload)
        )
      );
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
