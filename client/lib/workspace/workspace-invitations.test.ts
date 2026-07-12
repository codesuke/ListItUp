import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { acceptInvitation, resolveInvitation } from "./workspace-invitations";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "workspace invitations integration test skipped: DATABASE_URL is not set"
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

  const ownerId = randomUUID();
  const inviteeId = randomUUID();
  const otherUserId = randomUUID();
  const inviteeEmail = `invitee-${randomUUID()}@example.test`;
  const otherEmail = `other-${randomUUID()}@example.test`;
  const workspaceId = randomUUID();
  const validToken = randomUUID();
  const expiredToken = randomUUID();
  const acceptedToken = randomUUID();

  try {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          name: "Owner",
          email: `owner-${randomUUID()}@example.test`,
        },
        {
          id: inviteeId,
          name: "Invitee",
          email: inviteeEmail,
          emailVerified: true,
        },
        {
          id: otherUserId,
          name: "Other",
          email: otherEmail,
          emailVerified: true,
        },
      ],
    });
    await prisma.workspace.create({
      data: { id: workspaceId, name: "Launch Team", ownerId },
    });
    await prisma.workspaceInvitation.createMany({
      data: [
        {
          id: randomUUID(),
          workspaceId,
          email: inviteeEmail,
          token: validToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: randomUUID(),
          workspaceId,
          email: inviteeEmail,
          token: expiredToken,
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          id: randomUUID(),
          workspaceId,
          email: inviteeEmail,
          token: acceptedToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: new Date(),
        },
      ],
    });

    const resolved = await resolveInvitation(prisma, validToken);
    assert.deepEqual(resolved, {
      id: (
        await prisma.workspaceInvitation.findUniqueOrThrow({
          where: { token: validToken },
        })
      ).id,
      workspaceId,
      workspaceName: "Launch Team",
      email: inviteeEmail,
    });

    assert.equal(
      await resolveInvitation(prisma, expiredToken),
      null,
      "an expired invitation must not resolve"
    );
    assert.equal(
      await resolveInvitation(prisma, acceptedToken),
      null,
      "an already-accepted invitation must not resolve"
    );
    assert.equal(await resolveInvitation(prisma, "not-a-real-token"), null);

    const mismatchResult = await acceptInvitation(
      prisma,
      validToken,
      otherUserId,
      otherEmail
    );
    assert.deepEqual(mismatchResult, { status: "email-mismatch" });
    assert.equal(
      await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: otherUserId } },
      }),
      null,
      "a mismatched email must not create a membership"
    );

    const acceptResult = await acceptInvitation(
      prisma,
      validToken,
      inviteeId,
      inviteeEmail
    );
    assert.deepEqual(acceptResult, { status: "accepted", workspaceId });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: inviteeId } },
    });
    assert.ok(membership, "accepting must create a Workspace membership");
    assert.equal(membership?.role, "member");

    const invitationRow = await prisma.workspaceInvitation.findUnique({
      where: { token: validToken },
    });
    assert.ok(invitationRow?.acceptedAt);

    // Idempotent: accepting again (e.g. a double click) must not error or
    // duplicate the membership.
    const secondAccept = await acceptInvitation(
      prisma,
      validToken,
      inviteeId,
      inviteeEmail
    );
    assert.deepEqual(secondAccept, { status: "invalid" });
    const membershipCount = await prisma.workspaceMember.count({
      where: { workspaceId, userId: inviteeId },
    });
    assert.equal(membershipCount, 1);
  } finally {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, inviteeId, otherUserId] } },
    });
    await prisma.$disconnect();
  }

  console.log("workspace invitations integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
