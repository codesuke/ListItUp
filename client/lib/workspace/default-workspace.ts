import type { PrismaClient } from "@/generated/prisma/client";

// The Workspace a signed-in User lands in when they haven't asked for a
// specific page: their oldest SHARED membership (a stand-in for "primary
// team" — the domain model has no Workspace-visit tracking to pick a truly
// "most relevant" one from, see docs/QnA/listitup-profile-and-home-surface.md
// §6), falling back to their Personal Space when they belong to no SHARED
// Workspace yet.
export async function resolveDefaultWorkspaceId(
  database: PrismaClient,
  userId: string
): Promise<string | null> {
  const [oldestSharedMembership, personalMembership] = await Promise.all([
    database.workspaceMember.findFirst({
      where: { userId, workspace: { kind: "SHARED", deletedAt: null } },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    }),
    database.workspaceMember.findFirst({
      where: { userId, workspace: { kind: "PERSONAL" } },
      select: { workspaceId: true },
    }),
  ]);

  return oldestSharedMembership?.workspaceId ?? personalMembership?.workspaceId ?? null;
}
