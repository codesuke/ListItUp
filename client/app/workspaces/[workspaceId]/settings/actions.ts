"use server";

import { revalidatePath } from "next/cache";

import {
  workspaceOwnershipTransferredFromPreviousOwnerEmail,
  workspaceOwnershipTransferredToNewOwnerEmail,
} from "@/lib/mailer/email-templates/workspace-ownership-transfer";
import { mailer } from "@/lib/mailer/mailer";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { transferWorkspaceOwnership } from "@/lib/workspace/workspace-ownership";

function settingsPath(workspaceId: string): string {
  return `/workspaces/${workspaceId}/settings`;
}

export type TransferOwnershipState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function transferOwnershipAction(
  workspaceId: string,
  _prevState: TransferOwnershipState,
  formData: FormData
): Promise<TransferOwnershipState> {
  const session = await requireAuthenticatedSession(settingsPath(workspaceId));
  const newOwnerUserId = String(formData.get("newOwnerUserId") ?? "");
  const confirmedWorkspaceName = String(formData.get("confirmedWorkspaceName") ?? "");

  if (!newOwnerUserId) {
    return { status: "error", message: "Choose a member to become the new Owner." };
  }

  // Re-validated here regardless of the page's own Owner-only gating — a
  // Server Action needs the same authz check as an API endpoint (see
  // docs/agents/nextjs-conventions.md).
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: true },
  });

  if (!membership || membership.role !== "OWNER") {
    return { status: "error", message: "Only the current Owner can transfer ownership." };
  }

  if (confirmedWorkspaceName !== membership.workspace.name) {
    return { status: "error", message: "Type the Workspace name exactly to confirm." };
  }

  const newOwner = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: newOwnerUserId } },
    include: { user: true },
  });

  if (!newOwner) {
    return { status: "error", message: "That member is no longer in this Workspace." };
  }

  const result = await transferWorkspaceOwnership(prisma, workspaceId, newOwnerUserId);

  if (result.status !== "transferred") {
    return { status: "error", message: "Transfer failed. Try again." };
  }

  await Promise.all([
    mailer.send({
      to: newOwner.user.email,
      type: "workspace-ownership-transfer",
      template: workspaceOwnershipTransferredToNewOwnerEmail({
        workspaceName: membership.workspace.name,
        counterpartyName: session.user.name,
      }),
    }),
    mailer.send({
      to: session.user.email,
      type: "workspace-ownership-transfer",
      template: workspaceOwnershipTransferredFromPreviousOwnerEmail({
        workspaceName: membership.workspace.name,
        counterpartyName: newOwner.user.name,
      }),
    }),
  ]);

  revalidatePath(settingsPath(workspaceId));

  return { status: "success" };
}
