import type { PrismaClient } from "@/generated/prisma/client";

export type DeleteWorkspaceResult =
  | { status: "deleted" }
  | { status: "not-found" }
  | { status: "not-owner" }
  | { status: "personal-space" }
  | { status: "already-deleted" };

// Owner-only soft delete (#75, part of #74's larger restore-window spec).
// Non-membership and an unknown workspaceId both report "not-found" rather
// than leaking whether the Workspace exists to a non-member.
export async function deleteWorkspace(
  database: PrismaClient,
  workspaceId: string,
  requestingUserId: string
): Promise<DeleteWorkspaceResult> {
  return database.$transaction(async (tx) => {
    const membership = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: requestingUserId } },
      include: { workspace: true },
    });

    if (!membership) {
      return { status: "not-found" };
    }

    if (membership.workspace.kind === "PERSONAL") {
      return { status: "personal-space" };
    }

    if (membership.role !== "OWNER") {
      return { status: "not-owner" };
    }

    if (membership.workspace.deletedAt) {
      return { status: "already-deleted" };
    }

    await tx.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date(), deletedByUserId: requestingUserId },
    });

    return { status: "deleted" };
  });
}
