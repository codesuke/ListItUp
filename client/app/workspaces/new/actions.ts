"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import {
  createWorkspace,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@/lib/workspace/workspace-creation";

const NEW_WORKSPACE_PATH = "/workspaces/new";

export type CreateWorkspaceState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function createWorkspaceAction(
  _prevState: CreateWorkspaceState,
  formData: FormData
): Promise<CreateWorkspaceState> {
  const session = await requireAuthenticatedSession(NEW_WORKSPACE_PATH);
  const result = await createWorkspace(
    prisma,
    session.user.id,
    String(formData.get("name") ?? "")
  );

  if (result.status === "user-not-verified") {
    return { status: "error", message: "Verify your email before creating a Workspace." };
  }

  if (result.status === "invalid-name") {
    return {
      status: "error",
      message:
        result.reason === "empty"
          ? "Give the Workspace a name."
          : `Keep the name to ${WORKSPACE_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  revalidatePath("/workspaces", "layout");
  redirect(`/workspaces/${result.workspaceId}`);
}
