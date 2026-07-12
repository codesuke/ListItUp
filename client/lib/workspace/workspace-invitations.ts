import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

export interface InvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
}

function isLiveInvitation(invitation: {
  acceptedAt: Date | null;
  expiresAt: Date;
}): boolean {
  return !invitation.acceptedAt && invitation.expiresAt > new Date();
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
  };
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
      role: "member",
    },
    update: {},
  });

  await database.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  return { status: "accepted", workspaceId: invitation.workspaceId };
}
