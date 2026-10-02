"use server";

import { revalidatePath } from "next/cache";

import { normalizeEmail } from "@/lib/auth/normalize-email";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { mailer } from "@/lib/mailer/mailer";
import { createInvitation } from "@/lib/workspace/workspace-invitations";

function membersPath(workspaceId: string): string {
  return `/workspaces/${workspaceId}/settings/members`;
}

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; email: string };

const ERROR_MESSAGE = {
  forbidden: "Only the Workspace Owner or an Admin can invite people.",
  "invalid-role": "Choose Member or Viewer.",
  "invalid-email": "Enter an email address.",
  "already-member": "That person is already a member of this Workspace.",
  "send-failed": "Couldn't send the invitation email. Try again.",
} as const;

export async function createInvitationAction(
  workspaceId: string,
  _prevState: CreateInvitationState,
  formData: FormData
): Promise<CreateInvitationState> {
  const session = await requireAuthenticatedSession(membersPath(workspaceId));
  const email = normalizeEmail(formData.get("email"));
  const role = String(formData.get("role") ?? "");

  const result = await createInvitation(prisma, mailer, {
    workspaceId,
    actingUserId: session.user.id,
    email,
    role,
  });

  if (result.status !== "created") {
    return { status: "error", message: ERROR_MESSAGE[result.status] };
  }

  revalidatePath(membersPath(workspaceId));

  return { status: "success", email };
}
