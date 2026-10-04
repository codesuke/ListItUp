import type { PrismaClient } from "@/generated/prisma/client";
import { listDeletedWorkspacesForOwner } from "@/lib/workspace/workspace-deletion";

export type DeletedWorkspaceRow = {
  id: string;
  name: string;
  deletedAt: Date;
  daysRemaining: number;
};

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

// Kept separate from the page component itself, and taking an injected
// PrismaClient rather than importing the app's shared singleton, so the
// Owner-scoped listing logic can be exercised directly in a smoke test
// without a real Next.js request scope and without lib/prisma.ts's
// server-only guard, which throws under plain tsx execution (see
// Architecture.md).
export async function loadDeletedWorkspacesPageData(
  database: PrismaClient,
  userId: string
): Promise<DeletedWorkspaceRow[]> {
  const deletedWorkspaces = await listDeletedWorkspacesForOwner(database, userId);

  return deletedWorkspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    deletedAt: workspace.deletedAt,
    daysRemaining: Math.max(
      0,
      Math.ceil((workspace.restoreWindowEndsAt.getTime() - Date.now()) / MILLISECONDS_PER_DAY)
    ),
  }));
}
