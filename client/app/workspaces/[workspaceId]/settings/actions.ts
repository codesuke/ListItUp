"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  workspaceOwnershipTransferredFromPreviousOwnerEmail,
  workspaceOwnershipTransferredToNewOwnerEmail,
} from "@/lib/mailer/email-templates/workspace-ownership-transfer";
import { mailer } from "@/lib/mailer/mailer";
import { canManageWorkspace } from "@/lib/permissions/workspace-access";
import { prisma } from "@/lib/prisma";
import { requestIpAddress } from "@/lib/auth/request-ip-address";
import { recordSecurityEvent } from "@/lib/security/platform-operations";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";
import { deleteWorkspace } from "@/lib/workspace/workspace-deletion";
import { notifyMembersOfWorkspaceDeletion } from "@/lib/workspace/workspace-deletion-notifications";
import { transferWorkspaceOwnership } from "@/lib/workspace/workspace-ownership";
import { renameWorkspace, type RenameWorkspaceResult } from "@/lib/workspace/workspace-rename";
import { WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspace/workspace-creation";

function settingsPath(workspaceId: string): string {
  return `/workspaces/${workspaceId}/settings`;
}

export type RenameWorkspaceState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; name: string };

export async function renameWorkspaceAction(
  workspaceId: string,
  _prevState: RenameWorkspaceState,
  formData: FormData
): Promise<RenameWorkspaceState> {
  const session = await requireAuthenticatedSession(settingsPath(workspaceId));

  // Re-validated here regardless of the page's own Owner/Admin-only
  // gating — a Server Action needs the same authz check as an API
  // endpoint (see docs/agents/nextjs-conventions.md).
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: true },
  });

  if (!membership || membership.workspace.kind !== "SHARED" || !canManageWorkspace(membership.role)) {
    return { status: "error", message: "Only a Workspace Owner or Admin can rename this Workspace." };
  }

  const result: RenameWorkspaceResult = await renameWorkspace(
    prisma,
    workspaceId,
    String(formData.get("name") ?? "")
  );

  if (result.status === "invalid-name") {
    return {
      status: "error",
      message:
        result.reason === "empty"
          ? "Give the Workspace a name."
          : `Keep the name to ${WORKSPACE_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  revalidatePath(settingsPath(workspaceId));
  revalidatePath("/workspaces", "layout");

  return { status: "success", name: result.name };
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

  // The hardened transferWorkspaceOwnership() re-checks acting-Owner,
  // Workspace kind/deletion and new-Owner eligibility on its own (#90) —
  // this action no longer needs to pre-validate the target itself.
  const result = await transferWorkspaceOwnership(prisma, {
    workspaceId,
    actingUserId: session.user.id,
    newOwnerUserId,
  });

  if (result.status === "new-owner-not-a-member") {
    return { status: "error", message: "That member is no longer in this Workspace." };
  }

  if (result.status === "new-owner-ineligible") {
    return { status: "error", message: "Only an Admin or Member can become the new Owner." };
  }

  if (result.status !== "transferred") {
    return { status: "error", message: "Transfer failed. Try again." };
  }

  const newOwnerUser = await prisma.user.findUniqueOrThrow({ where: { id: newOwnerUserId } });

  await Promise.all([
    mailer.send({
      to: newOwnerUser.email,
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
        counterpartyName: newOwnerUser.name,
      }),
    }),
  ]);

  revalidatePath(settingsPath(workspaceId));

  return { status: "success" };
}

export type DeleteWorkspaceState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function deleteWorkspaceAction(
  workspaceId: string,
  _prevState: DeleteWorkspaceState,
  formData: FormData
): Promise<DeleteWorkspaceState> {
  const session = await requireAuthenticatedSession(settingsPath(workspaceId));
  const confirmedWorkspaceName = String(formData.get("confirmedWorkspaceName") ?? "");

  // Re-validated here regardless of the page's own Owner-only gating — a
  // Server Action needs the same authz check as an API endpoint (see
  // docs/agents/nextjs-conventions.md).
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: true },
  });

  if (!membership || membership.role !== "OWNER" || membership.workspace.kind !== "SHARED") {
    return { status: "error", message: "Only the current Owner can delete this Workspace." };
  }

  if (confirmedWorkspaceName !== membership.workspace.name) {
    return { status: "error", message: "Type the Workspace name exactly to confirm." };
  }

  const result = await deleteWorkspace(prisma, workspaceId, session.user.id);

  if (result.status === "already-deleted") {
    return { status: "error", message: "This Workspace is already deleted." };
  }

  if (result.status !== "deleted") {
    return { status: "error", message: "Delete failed. Try again." };
  }

  await recordSecurityEvent(prisma, {
    type: "workspace-deleted",
    userId: session.user.id,
    ipAddress: requestIpAddress(await headers()),
  });

  const deletedWorkspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });
  await notifyMembersOfWorkspaceDeletion(prisma, mailer, {
    workspaceId,
    workspaceName: membership.workspace.name,
    deletedByUserId: session.user.id,
    deletedByName: session.user.name,
    // Guaranteed non-null: `result.status === "deleted"` above confirms
    // deleteWorkspace just set it.
    deletedAt: deletedWorkspace.deletedAt!,
  });

  revalidatePath("/workspaces", "layout");

  const defaultWorkspaceId = await resolveDefaultWorkspaceId(prisma, session.user.id);
  redirect(defaultWorkspaceId ? `/workspaces/${defaultWorkspaceId}` : "/");
}
