import { randomUUID } from "node:crypto";

import type { PrismaClient, WorkspaceKind, WorkspaceRole } from "@/generated/prisma/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";
import type { Mailer, SendEmailResult } from "@/lib/mailer/mailer-core";
import { workspaceInvitationEmail } from "@/lib/mailer/email-templates/workspace-invitation";
import type { WorkspaceInvitationRateLimiter } from "@/lib/workspace/workspace-invitation-rate-limit";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

// Invitations may only ever grant these two Workspace-level roles — ADMIN
// and OWNER are never invite-time grants (see domain model spec).
export type InvitableWorkspaceRole = Extract<WorkspaceRole, "MEMBER" | "VIEWER">;

// The single named constant for how long a Pending Invitation lives — feeds
// both the stored expiry and the email's expiry text (see docs/Specs-Planned/
// workspace-invitations.md's Implementation Decisions).
export const INVITATION_EXPIRY_DAYS = 7;

function isInvitableRole(role: string): role is InvitableWorkspaceRole {
  return role === "MEMBER" || role === "VIEWER";
}

export interface InvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: InvitableWorkspaceRole;
}

function isLiveInvitation(invitation: {
  acceptedAt: Date | null;
  expiresAt: Date;
}): boolean {
  return !invitation.acceptedAt && invitation.expiresAt > new Date();
}

function requireInvitableRole(role: WorkspaceRole): InvitableWorkspaceRole {
  if (role !== "MEMBER" && role !== "VIEWER") {
    throw new Error(
      `Workspace invitations may only grant MEMBER or VIEWER, found ${role}.`
    );
  }

  return role;
}

function buildInviteUrl(token: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL must be set.");

  return `${baseUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
}

// Shared by createInvitation (new or resend-on-duplicate) and
// resendInvitation (explicit Resend control): a fresh token is generated and
// emailed, and only persisted once the send succeeds — a failed send must
// leave whatever Pending Invitation state already existed untouched (see
// docs/Specs-Planned/workspace-invitations.md).
async function sendInvitationEmail(
  mailer: Mailer,
  params: { to: string; inviterName: string; workspaceName: string; token: string }
): Promise<SendEmailResult> {
  return mailer.send({
    to: params.to,
    type: "workspace-invitation",
    template: workspaceInvitationEmail({
      inviterName: params.inviterName,
      workspaceName: params.workspaceName,
      inviteUrl: buildInviteUrl(params.token),
      expiresInDays: INVITATION_EXPIRY_DAYS,
    }),
  });
}

function newExpiry(): Date {
  return new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

// Shared by createInvitation and resendInvitation: only the Workspace Owner
// and Admins may create, resend or revoke invitations, and only for a
// SHARED Workspace (docs/Specs-Planned/workspace-invitations.md). A Deleted
// Workspace's settings are unreachable (#76), so its Owner/Admin can't act
// on invitations either, even via a crafted Server Action call.
function canActOnWorkspaceSettings<Membership extends { role: WorkspaceRole }>(
  membership: Membership | null | undefined,
  workspace: { kind: WorkspaceKind; deletedAt: Date | null } | null | undefined
): membership is Membership {
  return (
    membership != null &&
    workspace != null &&
    !isDeletedWorkspace(workspace) &&
    canAccessWorkspaceSettings({ role: membership.role, workspaceKind: workspace.kind })
  );
}

export async function resolveInvitation(
  database: PrismaClient,
  token: string
): Promise<InvitationDetails | null> {
  const invitation = await database.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: true },
  });

  // An invitation into a Deleted Workspace is reported the same as a
  // nonexistent one (#76) — nothing distinguishes the two to the caller.
  if (!invitation || !isLiveInvitation(invitation) || isDeletedWorkspace(invitation.workspace)) {
    return null;
  }

  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspace.name,
    email: invitation.email,
    role: requireInvitableRole(invitation.role),
  };
}

export async function resolveInvitationEmailForCallback(
  database: PrismaClient,
  callbackURL: string
): Promise<string | null> {
  let callback: URL;
  try {
    callback = new URL(callbackURL, "http://listitup.local");
  } catch {
    return null;
  }

  if (callback.pathname !== "/accept-invitation") {
    return null;
  }

  const token = callback.searchParams.get("token");
  if (!token) {
    return null;
  }

  return (await resolveInvitation(database, token))?.email ?? null;
}

export type AcceptInvitationResult =
  | { status: "accepted"; workspaceId: string }
  | { status: "invalid" }
  | { status: "email-mismatch" };

export async function acceptInvitation(
  database: PrismaClient,
  token: string,
  userId: string,
  userEmail: string
): Promise<AcceptInvitationResult> {
  const invitation = await database.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: true },
  });

  // Accepting into a Deleted Workspace fails the same as an expired or
  // already-accepted invitation (#76) — no WorkspaceMember row is granted.
  if (!invitation || !isLiveInvitation(invitation) || isDeletedWorkspace(invitation.workspace)) {
    return { status: "invalid" };
  }

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { status: "email-mismatch" };
  }

  await database.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: invitation.workspaceId, userId },
    },
    create: {
      id: randomUUID(),
      workspaceId: invitation.workspaceId,
      userId,
      role: requireInvitableRole(invitation.role),
    },
    update: {},
  });

  await database.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  return { status: "accepted", workspaceId: invitation.workspaceId };
}

// Shared by createInvitation and resendInvitation: both send an invitation
// email and must consult the same per-inviter/per-Workspace send limit (see
// docs/agents/issue-tracker.md issue #68's rate-limiting decision).
export interface InvitationSendDependencies {
  mailer: Mailer;
  rateLimiter: WorkspaceInvitationRateLimiter;
}

export interface CreateInvitationInput {
  workspaceId: string;
  actingUserId: string;
  email: string;
  role: string;
}

export type CreateInvitationResult =
  | { status: "created"; invitationId: string; resent: boolean }
  | { status: "forbidden" }
  | { status: "invalid-role" }
  | { status: "invalid-email" }
  | { status: "already-member" }
  | { status: "rate-limited" }
  | { status: "send-failed" };

// Creates a Pending Invitation and emails it. Authorization and role
// validation happen here, not just on the invite form's page — a Server
// Action calling this is not itself a security boundary (see
// docs/agents/nextjs-conventions.md).
export async function createInvitation(
  database: PrismaClient,
  dependencies: InvitationSendDependencies,
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const actingMembership = await database.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: input.workspaceId, userId: input.actingUserId },
    },
    include: { user: true, workspace: true },
  });

  if (!canActOnWorkspaceSettings(actingMembership, actingMembership?.workspace)) {
    return { status: "forbidden" };
  }

  if (!isInvitableRole(input.role)) {
    return { status: "invalid-role" };
  }

  const email = normalizeEmail(input.email);

  if (!email) {
    return { status: "invalid-email" };
  }

  const existingUser = await database.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await database.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: input.workspaceId, userId: existingUser.id },
      },
    });
    if (existingMembership) {
      return { status: "already-member" };
    }
  }

  // Inviting an email that already has an unaccepted invitation resends
  // that invitation instead of creating a second row (docs/Specs-Planned/
  // workspace-invitations.md's duplicate-handling decision).
  const existingInvitation = await database.workspaceInvitation.findFirst({
    where: { workspaceId: input.workspaceId, email, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const allowed = await dependencies.rateLimiter.consume(
    input.actingUserId,
    input.workspaceId
  );
  if (!allowed) {
    return { status: "rate-limited" };
  }

  const token = randomUUID();
  const sendResult = await sendInvitationEmail(dependencies.mailer, {
    to: email,
    inviterName: actingMembership.user.name,
    workspaceName: actingMembership.workspace.name,
    token,
  });

  if (!sendResult.ok) {
    return { status: "send-failed" };
  }

  if (existingInvitation) {
    await database.workspaceInvitation.update({
      where: { id: existingInvitation.id },
      data: { token, expiresAt: newExpiry(), role: input.role, invitedById: input.actingUserId },
    });

    return { status: "created", invitationId: existingInvitation.id, resent: true };
  }

  const invitationId = randomUUID();
  await database.workspaceInvitation.create({
    data: {
      id: invitationId,
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      token,
      expiresAt: newExpiry(),
      invitedById: input.actingUserId,
    },
  });

  return { status: "created", invitationId, resent: false };
}

export type ResendInvitationResult =
  | { status: "resent" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "already-accepted" }
  | { status: "rate-limited" }
  | { status: "send-failed" };

// Explicit Resend control on a Pending Invitation row (pending or expired):
// issues a fresh token and resets the 7-day expiry, invalidating the old
// link. Only persisted once the email send succeeds, so a failed send
// leaves the previous invitation exactly as it was.
export async function resendInvitation(
  database: PrismaClient,
  dependencies: InvitationSendDependencies,
  input: { invitationId: string; actingUserId: string }
): Promise<ResendInvitationResult> {
  const invitation = await database.workspaceInvitation.findUnique({
    where: { id: input.invitationId },
    include: { workspace: true },
  });

  if (!invitation) {
    return { status: "not-found" };
  }

  // Authorization is checked immediately after loading the invitation (the
  // minimum needed to know which Workspace to check against) and before any
  // other branching, so an unauthorized caller learns nothing about this
  // invitation's accepted state (see docs/agents/nextjs-conventions.md and
  // createInvitation's identical ordering above).
  const actingMembership = await database.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: invitation.workspaceId, userId: input.actingUserId },
    },
    include: { user: true },
  });

  if (!canActOnWorkspaceSettings(actingMembership, invitation.workspace)) {
    return { status: "forbidden" };
  }

  if (invitation.acceptedAt) {
    return { status: "already-accepted" };
  }

  const allowed = await dependencies.rateLimiter.consume(
    input.actingUserId,
    invitation.workspaceId
  );
  if (!allowed) {
    return { status: "rate-limited" };
  }

  const token = randomUUID();
  const sendResult = await sendInvitationEmail(dependencies.mailer, {
    to: invitation.email,
    inviterName: actingMembership.user.name,
    workspaceName: invitation.workspace.name,
    token,
  });

  if (!sendResult.ok) {
    return { status: "send-failed" };
  }

  await database.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { token, expiresAt: newExpiry() },
  });

  return { status: "resent" };
}

export interface RevokeInvitationInput {
  invitationId: string;
  actingUserId: string;
}

export type RevokeInvitationResult =
  | { status: "revoked" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "already-accepted" };

// Hard-deletes a Pending Invitation. The old token then resolves as invalid
// via resolveInvitation (see docs/Specs-Planned/workspace-invitations.md's
// revoke decision). Authorization is enforced here, not just on the members
// page — a Server Action calling this is not itself a security boundary. An
// already-accepted invitation is never deleted: it stays as a historical
// row, excluded from the pending list by loadWorkspaceMembersPageData.
export async function revokeInvitation(
  database: PrismaClient,
  input: RevokeInvitationInput
): Promise<RevokeInvitationResult> {
  const invitation = await database.workspaceInvitation.findUnique({
    where: { id: input.invitationId },
    include: { workspace: true },
  });

  if (!invitation) {
    return { status: "not-found" };
  }

  // Authorization is checked immediately after loading the invitation (the
  // minimum needed to know which Workspace to check against) and before any
  // other branching, matching resendInvitation's identical ordering above.
  const actingMembership = await database.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: invitation.workspaceId, userId: input.actingUserId },
    },
  });

  if (!canActOnWorkspaceSettings(actingMembership, invitation.workspace)) {
    return { status: "forbidden" };
  }

  if (invitation.acceptedAt) {
    return { status: "already-accepted" };
  }

  await database.workspaceInvitation.delete({ where: { id: input.invitationId } });

  return { status: "revoked" };
}
