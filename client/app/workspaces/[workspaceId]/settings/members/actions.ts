"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeEmail } from "@/lib/auth/normalize-email";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { mailer } from "@/lib/mailer/mailer";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/lib/workspace/workspace-invitations";
import { leaveWorkspace, removeWorkspaceMember } from "@/lib/workspace/workspace-membership";
import { updateWorkspaceMemberRole } from "@/lib/workspace/workspace-member-roles";
import {
  createRedisWorkspaceInvitationRateLimiter,
  GENERIC_INVITATION_RATE_LIMIT_MESSAGE,
} from "@/lib/workspace/workspace-invitation-rate-limit";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL must be set for Workspace invitation rate limits.");
}

const invitationRateLimiter = createRedisWorkspaceInvitationRateLimiter(redisUrl);
const invitationSendDependencies = { mailer, rateLimiter: invitationRateLimiter };

function membersPath(workspaceId: string): string {
  return `/workspaces/${workspaceId}/settings/members`;
}

const SEND_FAILED_MESSAGE = "Couldn't send the invitation email. Try again.";

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; email: string; resent: boolean };

const ERROR_MESSAGE = {
  forbidden: "Only the Workspace Owner or an Admin can invite people.",
  "invalid-role": "Choose Member or Viewer.",
  "invalid-email": "Enter an email address.",
  "already-member": "That person is already a member of this Workspace.",
  "rate-limited": GENERIC_INVITATION_RATE_LIMIT_MESSAGE,
  "send-failed": SEND_FAILED_MESSAGE,
} as const;

export async function createInvitationAction(
  workspaceId: string,
  _prevState: CreateInvitationState,
  formData: FormData
): Promise<CreateInvitationState> {
  const session = await requireAuthenticatedSession(membersPath(workspaceId));
  const email = normalizeEmail(formData.get("email"));
  const role = String(formData.get("role") ?? "");

  const result = await createInvitation(prisma, invitationSendDependencies, {
    workspaceId,
    actingUserId: session.user.id,
    email,
    role,
  });

  if (result.status !== "created") {
    return { status: "error", message: ERROR_MESSAGE[result.status] };
  }

  revalidatePath(membersPath(workspaceId));

  return { status: "success", email, resent: result.resent };
}

export type ResendInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const RESEND_ERROR_MESSAGE = {
  forbidden: "Only the Workspace Owner or an Admin can resend invitations.",
  "not-found": "That invitation no longer exists.",
  "already-accepted": "That invitation has already been accepted.",
  "rate-limited": GENERIC_INVITATION_RATE_LIMIT_MESSAGE,
  "send-failed": SEND_FAILED_MESSAGE,
} as const;

// prevState/formData are unused: the Resend control is a bare button with
// no form fields, but useActionState requires this exact signature shape.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function resendInvitationAction(
  workspaceId: string,
  invitationId: string,
  _prevState: ResendInvitationState,
  _formData: FormData
): Promise<ResendInvitationState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const session = await requireAuthenticatedSession(membersPath(workspaceId));

  const result = await resendInvitation(prisma, invitationSendDependencies, {
    invitationId,
    actingUserId: session.user.id,
  });

  if (result.status !== "resent") {
    return { status: "error", message: RESEND_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(membersPath(workspaceId));

  return { status: "success" };
}

export type UpdateMemberRoleState =
  | { status: "idle" }
  | { status: "error"; message: string };

const UPDATE_MEMBER_ROLE_ERROR_MESSAGE = {
  forbidden: "Only the Workspace Owner or an Admin can change roles.",
  "invalid-role": "Choose Admin, Member, or Viewer.",
  "not-found": "That person is no longer a member of this Workspace.",
  "cannot-change-owner": "The Workspace Owner's role can only change via ownership transfer.",
} as const;

function soleLeadBlockMessage(count: number): string {
  const lists = count === 1 ? "List" : "Lists";
  return `This person is the sole Lead of ${count} ${lists} — promote another Lead on each one first.`;
}

export async function updateMemberRoleAction(
  workspaceId: string,
  targetUserId: string,
  _prevState: UpdateMemberRoleState,
  formData: FormData
): Promise<UpdateMemberRoleState> {
  const session = await requireAuthenticatedSession(membersPath(workspaceId));
  const role = String(formData.get("role") ?? "");

  const result = await updateWorkspaceMemberRole(prisma, {
    workspaceId,
    actingUserId: session.user.id,
    targetUserId,
    role,
  });

  if (result.status === "sole-lead-block") {
    return { status: "error", message: soleLeadBlockMessage(result.count) };
  }

  if (result.status !== "updated") {
    return { status: "error", message: UPDATE_MEMBER_ROLE_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(membersPath(workspaceId));

  return { status: "idle" };
}

export type RemoveMemberState =
  | { status: "idle" }
  | { status: "error"; message: string };

const REMOVE_MEMBER_ERROR_MESSAGE = {
  forbidden: "Only the Workspace Owner or an Admin can remove members.",
  "not-found": "That person is no longer a member of this Workspace.",
  "cannot-remove-owner": "The Workspace Owner can't be removed.",
} as const;

// prevState/formData are unused: the Remove control is a bare button with
// no form fields, but useActionState requires this exact signature shape
// (see resendInvitationAction above).
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function removeMemberAction(
  workspaceId: string,
  targetUserId: string,
  _prevState: RemoveMemberState,
  _formData: FormData
): Promise<RemoveMemberState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const session = await requireAuthenticatedSession(membersPath(workspaceId));

  const result = await removeWorkspaceMember(prisma, {
    actingUserId: session.user.id,
    workspaceId,
    targetUserId,
  });

  if (result.status === "sole-lead-block") {
    return { status: "error", message: soleLeadBlockMessage(result.count) };
  }

  if (result.status !== "removed") {
    return { status: "error", message: REMOVE_MEMBER_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(membersPath(workspaceId));

  return { status: "idle" };
}

export type LeaveWorkspaceState =
  | { status: "idle" }
  | { status: "error"; message: string };

const LEAVE_WORKSPACE_ERROR_MESSAGE = {
  "not-found": "You're not a member of this Workspace.",
  "owner-must-transfer-first": "Transfer ownership before leaving this Workspace.",
} as const;

// prevState/formData are unused: the Leave control is a bare button with no
// form fields, but useActionState requires this exact signature shape (see
// resendInvitationAction above).
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function leaveWorkspaceAction(
  workspaceId: string,
  _prevState: LeaveWorkspaceState,
  _formData: FormData
): Promise<LeaveWorkspaceState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const session = await requireAuthenticatedSession(membersPath(workspaceId));

  const result = await leaveWorkspace(prisma, { workspaceId, userId: session.user.id });

  if (result.status === "sole-lead-block") {
    return { status: "error", message: soleLeadBlockMessage(result.count) };
  }

  if (result.status !== "left") {
    return { status: "error", message: LEAVE_WORKSPACE_ERROR_MESSAGE[result.status] };
  }

  revalidatePath("/workspaces", "layout");

  const defaultWorkspaceId = await resolveDefaultWorkspaceId(prisma, session.user.id);
  redirect(defaultWorkspaceId ? `/workspaces/${defaultWorkspaceId}` : "/");
}

export type RevokeInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string };

const REVOKE_ERROR_MESSAGE = {
  forbidden: "Only the Workspace Owner or an Admin can revoke invitations.",
  "not-found": "That invitation no longer exists.",
  "already-accepted": "That invitation has already been accepted.",
} as const;

// prevState/formData are unused: the Revoke control is a bare button with
// no form fields, but useActionState requires this exact signature shape
// (see resendInvitationAction above).
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function revokeInvitationAction(
  workspaceId: string,
  invitationId: string,
  _prevState: RevokeInvitationState,
  _formData: FormData
): Promise<RevokeInvitationState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const session = await requireAuthenticatedSession(membersPath(workspaceId));

  const result = await revokeInvitation(prisma, {
    invitationId,
    actingUserId: session.user.id,
  });

  if (result.status !== "revoked") {
    return { status: "error", message: REVOKE_ERROR_MESSAGE[result.status] };
  }

  revalidatePath(membersPath(workspaceId));

  return { status: "idle" };
}
