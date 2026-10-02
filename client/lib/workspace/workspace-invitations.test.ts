import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { Mailer, SendEmailInput, SendEmailResult } from "@/lib/mailer/mailer-core";
import {
  acceptInvitation,
  createInvitation,
  INVITATION_EXPIRY_DAYS,
  resendInvitation,
  resolveInvitation,
} from "./workspace-invitations";

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
  const nonInvitableRoleToken = randomUUID();

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
      data: { id: workspaceId, name: "Launch Team" },
    });
    await prisma.workspaceMember.create({
      data: { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
    });
    await prisma.workspaceInvitation.createMany({
      data: [
        {
          id: randomUUID(),
          workspaceId,
          email: inviteeEmail,
          role: "VIEWER",
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
        {
          id: randomUUID(),
          workspaceId,
          email: inviteeEmail,
          role: "ADMIN",
          token: nonInvitableRoleToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
      role: "VIEWER",
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

    await assert.rejects(
      () => resolveInvitation(prisma, nonInvitableRoleToken),
      /may only grant MEMBER or VIEWER/,
      "a corrupted ADMIN-role invitation must never resolve as invitable"
    );
    await assert.rejects(
      () => acceptInvitation(prisma, nonInvitableRoleToken, inviteeId, inviteeEmail),
      /may only grant MEMBER or VIEWER/,
      "accepting a corrupted ADMIN-role invitation must never grant membership"
    );
    assert.equal(
      await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: inviteeId } },
      }),
      null,
      "a rejected ADMIN-role invitation must not create a membership"
    );

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
    assert.equal(
      membership?.role,
      "VIEWER",
      "the accepted membership's role must match the invitation's role"
    );

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

async function runCreateInvitationTests() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "createInvitation integration test skipped: DATABASE_URL is not set"
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

  const sentEmails: SendEmailInput[] = [];
  let nextSendShouldFail = false;
  const mailer: Mailer = {
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      if (nextSendShouldFail) {
        nextSendShouldFail = false;
        return { ok: false, reason: "send-failed" };
      }
      sentEmails.push(input);
      return { ok: true };
    },
  };

  const workspaceId = randomUUID();
  const personalSpaceId = randomUUID();
  const ownerId = randomUUID();
  const adminId = randomUUID();
  const memberId = randomUUID();
  const viewerId = randomUUID();
  const existingMemberUserId = randomUUID();
  const existingMemberEmail = `existing-member-${randomUUID()}@example.test`;
  const userIds = [ownerId, adminId, memberId, viewerId, existingMemberUserId];

  try {
    await prisma.user.createMany({
      data: [
        { id: ownerId, name: "Owner", email: `owner-${randomUUID()}@example.test` },
        { id: adminId, name: "Admin", email: `admin-${randomUUID()}@example.test` },
        { id: memberId, name: "Member", email: `member-${randomUUID()}@example.test` },
        { id: viewerId, name: "Viewer", email: `viewer-${randomUUID()}@example.test` },
        { id: existingMemberUserId, name: "Existing Member", email: existingMemberEmail },
      ],
    });
    await prisma.workspace.createMany({
      data: [
        { id: workspaceId, name: "Launch Team", kind: "SHARED" },
        { id: personalSpaceId, name: "Solo Space", kind: "PERSONAL" },
      ],
    });
    await prisma.workspaceMember.createMany({
      data: [
        { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
        { id: randomUUID(), workspaceId, userId: adminId, role: "ADMIN" },
        { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
        { id: randomUUID(), workspaceId, userId: viewerId, role: "VIEWER" },
        { id: randomUUID(), workspaceId, userId: existingMemberUserId, role: "MEMBER" },
        { id: randomUUID(), workspaceId: personalSpaceId, userId: ownerId, role: "OWNER" },
      ],
    });

    // Member, Viewer, non-members and Personal Spaces are all rejected.
    for (const [label, actingUserId, targetWorkspaceId] of [
      ["Member", memberId, workspaceId],
      ["Viewer", viewerId, workspaceId],
      ["non-member", randomUUID(), workspaceId],
      ["Owner of a Personal Space", ownerId, personalSpaceId],
    ] as const) {
      const result = await createInvitation(prisma, mailer, {
        workspaceId: targetWorkspaceId,
        actingUserId,
        email: `rejected-${randomUUID()}@example.test`,
        role: "MEMBER",
      });
      assert.deepEqual(result, { status: "forbidden" }, `${label} must be forbidden from inviting`);
    }
    assert.equal(sentEmails.length, 0, "no email should have been sent for a forbidden invite");

    // Only MEMBER or VIEWER are accepted invite-time roles.
    for (const role of ["ADMIN", "OWNER", "not-a-role"]) {
      const result = await createInvitation(prisma, mailer, {
        workspaceId,
        actingUserId: ownerId,
        email: `bad-role-${randomUUID()}@example.test`,
        role,
      });
      assert.deepEqual(result, { status: "invalid-role" });
    }

    // Inviting an existing Workspace member is rejected.
    const alreadyMemberResult = await createInvitation(prisma, mailer, {
      workspaceId,
      actingUserId: adminId,
      email: existingMemberEmail.toUpperCase(),
      role: "MEMBER",
    });
    assert.deepEqual(alreadyMemberResult, { status: "already-member" });

    // A successful invite (Admin inviting), with casing normalized, emails
    // the invitee and names the inviter, Workspace and expiry.
    const inviteeEmail = `Invitee-${randomUUID()}@Example.test`;
    const createResult = await createInvitation(prisma, mailer, {
      workspaceId,
      actingUserId: adminId,
      email: inviteeEmail,
      role: "VIEWER",
    });
    assert.equal(createResult.status, "created");

    const createdRow = await prisma.workspaceInvitation.findUnique({
      where: { id: (createResult as { invitationId: string }).invitationId },
    });
    assert.ok(createdRow, "a Pending Invitation row must exist");
    assert.equal(createdRow?.email, inviteeEmail.trim().toLowerCase());
    assert.equal(createdRow?.role, "VIEWER");
    assert.equal(createdRow?.invitedById, adminId);
    const expiryDays = Math.round(
      ((createdRow!.expiresAt.getTime() - createdRow!.createdAt.getTime()) /
        (24 * 60 * 60 * 1000))
    );
    assert.equal(expiryDays, INVITATION_EXPIRY_DAYS);

    const sent = sentEmails.find((send) => send.to === inviteeEmail.trim().toLowerCase());
    assert.ok(sent, "the invitation email must be sent to the normalized address");
    assert.match(sent!.template.text, /Admin/);
    assert.match(sent!.template.text, /Launch Team/);
    assert.match(sent!.template.text, new RegExp(`${INVITATION_EXPIRY_DAYS} days`));

    // A failed send leaves no Pending Invitation behind.
    nextSendShouldFail = true;
    const failedEmail = `send-fails-${randomUUID()}@example.test`;
    const failedResult = await createInvitation(prisma, mailer, {
      workspaceId,
      actingUserId: ownerId,
      email: failedEmail,
      role: "MEMBER",
    });
    assert.deepEqual(failedResult, { status: "send-failed" });
    assert.equal(
      await prisma.workspaceInvitation.count({ where: { email: failedEmail } }),
      0,
      "a failed send must leave no Pending Invitation row"
    );

    // Inviting an email that already has an unaccepted invitation resends
    // it instead of creating a second row, and the new role/inviter apply.
    const dedupEmail = `dedup-${randomUUID()}@example.test`;
    const firstInvite = await createInvitation(prisma, mailer, {
      workspaceId,
      actingUserId: adminId,
      email: dedupEmail,
      role: "VIEWER",
    });
    assert.deepEqual(firstInvite, {
      status: "created",
      invitationId: (firstInvite as { invitationId: string }).invitationId,
      resent: false,
    });
    const firstToken = (
      await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: (firstInvite as { invitationId: string }).invitationId },
      })
    ).token;

    const secondInvite = await createInvitation(prisma, mailer, {
      workspaceId,
      actingUserId: ownerId,
      email: dedupEmail,
      role: "MEMBER",
    });
    assert.deepEqual(secondInvite, {
      status: "created",
      invitationId: (firstInvite as { invitationId: string }).invitationId,
      resent: true,
    });
    assert.equal(
      await prisma.workspaceInvitation.count({ where: { workspaceId, email: dedupEmail } }),
      1,
      "re-inviting a Pending email must not create a duplicate row"
    );
    const dedupRow = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: (firstInvite as { invitationId: string }).invitationId },
    });
    assert.equal(dedupRow.role, "MEMBER", "the resent invitation must take the new role");
    assert.equal(dedupRow.invitedById, ownerId, "the resent invitation must take the new inviter");
    assert.notEqual(dedupRow.token, firstToken, "resending must issue a new token");
    assert.equal(
      await resolveInvitation(prisma, firstToken),
      null,
      "the old token must resolve as invalid after a dedup resend"
    );
  } finally {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: [workspaceId, personalSpaceId] } },
    });
    await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, personalSpaceId] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }

  console.log("createInvitation integration test passed");
}

async function runResendInvitationTests() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "resendInvitation integration test skipped: DATABASE_URL is not set"
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

  const sentEmails: SendEmailInput[] = [];
  let nextSendShouldFail = false;
  const mailer: Mailer = {
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      if (nextSendShouldFail) {
        nextSendShouldFail = false;
        return { ok: false, reason: "send-failed" };
      }
      sentEmails.push(input);
      return { ok: true };
    },
  };

  const workspaceId = randomUUID();
  const ownerId = randomUUID();
  const adminId = randomUUID();
  const memberId = randomUUID();
  const userIds = [ownerId, adminId, memberId];

  async function seedInvitation(options: {
    expired?: boolean;
    accepted?: boolean;
  } = {}): Promise<string> {
    const invitationId = randomUUID();
    await prisma.workspaceInvitation.create({
      data: {
        id: invitationId,
        workspaceId,
        email: `invitee-${randomUUID()}@example.test`,
        role: "VIEWER",
        token: randomUUID(),
        expiresAt: options.expired
          ? new Date(Date.now() - 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: options.accepted ? new Date() : null,
        invitedById: adminId,
      },
    });
    return invitationId;
  }

  try {
    await prisma.user.createMany({
      data: [
        { id: ownerId, name: "Owner", email: `owner-${randomUUID()}@example.test` },
        { id: adminId, name: "Admin", email: `admin-${randomUUID()}@example.test` },
        { id: memberId, name: "Member", email: `member-${randomUUID()}@example.test` },
      ],
    });
    await prisma.workspace.create({ data: { id: workspaceId, name: "Launch Team", kind: "SHARED" } });
    await prisma.workspaceMember.createMany({
      data: [
        { id: randomUUID(), workspaceId, userId: ownerId, role: "OWNER" },
        { id: randomUUID(), workspaceId, userId: adminId, role: "ADMIN" },
        { id: randomUUID(), workspaceId, userId: memberId, role: "MEMBER" },
      ],
    });

    // Only Owner and Admin can resend.
    const forbiddenInvitationId = await seedInvitation();
    const memberResult = await resendInvitation(prisma, mailer, {
      invitationId: forbiddenInvitationId,
      actingUserId: memberId,
    });
    assert.deepEqual(memberResult, { status: "forbidden" });
    assert.equal(sentEmails.length, 0);

    // A non-existent invitation resolves as not-found.
    assert.deepEqual(
      await resendInvitation(prisma, mailer, { invitationId: randomUUID(), actingUserId: ownerId }),
      { status: "not-found" }
    );

    // An already-accepted invitation cannot be resent.
    const acceptedInvitationId = await seedInvitation({ accepted: true });
    assert.deepEqual(
      await resendInvitation(prisma, mailer, {
        invitationId: acceptedInvitationId,
        actingUserId: ownerId,
      }),
      { status: "already-accepted" }
    );

    // Resend issues a new token and resets expiry; the old token invalidates.
    const pendingInvitationId = await seedInvitation();
    const pendingBefore = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: pendingInvitationId },
    });
    const resentResult = await resendInvitation(prisma, mailer, {
      invitationId: pendingInvitationId,
      actingUserId: adminId,
    });
    assert.deepEqual(resentResult, { status: "resent" });

    const pendingAfter = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: pendingInvitationId },
    });
    assert.notEqual(pendingAfter.token, pendingBefore.token);
    assert.ok(pendingAfter.expiresAt.getTime() > pendingBefore.expiresAt.getTime());
    assert.equal(
      await resolveInvitation(prisma, pendingBefore.token),
      null,
      "the old token must resolve as invalid after a resend"
    );
    const sentToPending = sentEmails.find((send) => send.to === pendingAfter.email);
    assert.ok(sentToPending, "resending must email the invitee again");

    // An expired invitation can be resent, and then accepted.
    const expiredInvitationId = await seedInvitation({ expired: true });
    assert.deepEqual(
      await resendInvitation(prisma, mailer, {
        invitationId: expiredInvitationId,
        actingUserId: ownerId,
      }),
      { status: "resent" }
    );
    const expiredAfter = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: expiredInvitationId },
    });
    const inviteeId = randomUUID();
    userIds.push(inviteeId);
    await prisma.user.create({
      data: { id: inviteeId, name: "Invitee", email: expiredAfter.email, emailVerified: true },
    });
    assert.deepEqual(
      await acceptInvitation(prisma, expiredAfter.token, inviteeId, expiredAfter.email),
      { status: "accepted", workspaceId }
    );

    // A failed send leaves the previous invitation state unchanged.
    const failingInvitationId = await seedInvitation();
    const failingBefore = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: failingInvitationId },
    });
    nextSendShouldFail = true;
    assert.deepEqual(
      await resendInvitation(prisma, mailer, {
        invitationId: failingInvitationId,
        actingUserId: ownerId,
      }),
      { status: "send-failed" }
    );
    const failingAfter = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: failingInvitationId },
    });
    assert.deepEqual(failingAfter, failingBefore);
  } finally {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }

  console.log("resendInvitation integration test passed");
}

void run()
  .then(runCreateInvitationTests)
  .then(runResendInvitationTests)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
