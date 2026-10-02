import { randomUUID } from "node:crypto";

import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";
import type { Mailer } from "@/lib/mailer/mailer-core";
import { workspaceInvitationEmail } from "@/lib/mailer/email-templates/workspace-invitation";

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

export async function resolveInvitation(
  database: PrismaClient,
  token: string
): Promise<InvitationDetails | null> {
  const invitation = await database.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!invitation || !isLiveInvitation(invitation)) {
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
  });

  if (!invitation || !isLiveInvitation(invitation)) {
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

export interface CreateInvitationInput {
  workspaceId: string;
  actingUserId: string;
  email: string;
  role: string;
}

export type CreateInvitationResult =
  | { status: "created"; invitationId: string }
  | { status: "forbidden" }
  | { status: "invalid-role" }
  | { status: "invalid-email" }
  | { status: "already-member" }
  | { status: "send-failed" };

// Creates a Pending Invitation and emails it. Authorization and role
// validation happen here, not just on the invite form's page — a Server
// Action calling this is not itself a security boundary (see
// docs/agents/nextjs-conventions.md).
export async function createInvitation(
  database: PrismaClient,
  mailer: Mailer,
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const actingMembership = await database.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: input.workspaceId, userId: input.actingUserId },
    },
    include: { user: true, workspace: true },
  });

  if (
    !actingMembership ||
    !canAccessWorkspaceSettings({
      role: actingMembership.role,
      workspaceKind: actingMembership.workspace.kind,
    })
  ) {
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

  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL must be set.");

  const invitationId = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await database.workspaceInvitation.create({
    data: {
      id: invitationId,
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      token,
      expiresAt,
      invitedById: input.actingUserId,
    },
  });

  const inviteUrl = `${baseUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
  const result = await mailer.send({
    to: email,
    type: "workspace-invitation",
    template: workspaceInvitationEmail({
      inviterName: actingMembership.user.name,
      workspaceName: actingMembership.workspace.name,
      inviteUrl,
      expiresInDays: INVITATION_EXPIRY_DAYS,
    }),
  });

  if (!result.ok) {
    await database.workspaceInvitation.delete({ where: { id: invitationId } });
    return { status: "send-failed" };
  }

  return { status: "created", invitationId };
}
