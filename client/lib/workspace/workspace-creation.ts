import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

export const WORKSPACE_NAME_MAX_LENGTH = 80;

export type CreateWorkspaceResult =
  | { status: "created"; workspaceId: string }
  | { status: "invalid-name"; reason: "empty" | "too-long" }
  | { status: "user-not-verified" };

export async function createWorkspace(
  database: PrismaClient,
  userId: string,
  rawName: string
): Promise<CreateWorkspaceResult> {
  const user = await database.user.findUnique({ where: { id: userId } });

  if (!user || !user.emailVerified) {
    return { status: "user-not-verified" };
  }

  const name = rawName.trim();

  if (name.length === 0) {
    return { status: "invalid-name", reason: "empty" };
  }

  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return { status: "invalid-name", reason: "too-long" };
  }

  const workspace = await database.workspace.create({
    data: {
      id: randomUUID(),
      name,
      kind: "SHARED",
      members: {
        create: [{ id: randomUUID(), userId, role: "OWNER" }],
      },
    },
  });

  return { status: "created", workspaceId: workspace.id };
}
