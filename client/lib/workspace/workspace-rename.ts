import type { PrismaClient } from "@/generated/prisma/client";

import { WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspace/workspace-creation";

export type RenameWorkspaceResult =
  | { status: "renamed"; name: string }
  | { status: "invalid-name"; reason: "empty" | "too-long" };

export async function renameWorkspace(
  database: PrismaClient,
  workspaceId: string,
  rawName: string
): Promise<RenameWorkspaceResult> {
  const name = rawName.trim();

  if (name.length === 0) {
    return { status: "invalid-name", reason: "empty" };
  }

  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return { status: "invalid-name", reason: "too-long" };
  }

  await database.workspace.update({
    where: { id: workspaceId },
    data: { name },
  });

  return { status: "renamed", name };
}
