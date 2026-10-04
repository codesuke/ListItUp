"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requestIpAddress } from "@/lib/auth/request-ip-address";
import { recordSecurityEvent } from "@/lib/security/platform-operations";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { restoreWorkspace } from "@/lib/workspace/workspace-deletion";
import { notifyMembersOfWorkspaceRestoration } from "@/lib/workspace/workspace-deletion-notifications";
import { mailer } from "@/lib/mailer/mailer";

const DELETED_WORKSPACES_PATH = "/workspaces/deleted";

export type RestoreWorkspaceState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function restoreWorkspaceAction(
  workspaceId: string
): Promise<RestoreWorkspaceState> {
  const session = await requireAuthenticatedSession(DELETED_WORKSPACES_PATH);

  // Re-validated here regardless of the page only listing Workspaces the
  // viewer owns — a Server Action needs the same authz check as an API
  // endpoint (see docs/agents/nextjs-conventions.md), since this is callable
  // directly with any workspaceId.
  const result = await restoreWorkspace(prisma, workspaceId, session.user.id);

  if (result.status === "not-found" || result.status === "not-owner") {
    return { status: "error", message: "Only the Owner can restore this Workspace." };
  }

  if (result.status === "not-deleted") {
    return { status: "error", message: "This Workspace isn't deleted." };
  }

  if (result.status === "window-expired") {
    return { status: "error", message: "The Restore Window for this Workspace has closed." };
  }

  await recordSecurityEvent(prisma, {
    type: "workspace-restored",
    userId: session.user.id,
    ipAddress: requestIpAddress(await headers()),
  });

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  await notifyMembersOfWorkspaceRestoration(prisma, mailer, {
    workspaceId,
    workspaceName: workspace.name,
    restoredByUserId: session.user.id,
  });

  revalidatePath("/workspaces", "layout");
  revalidatePath(DELETED_WORKSPACES_PATH);

  return { status: "success" };
}
