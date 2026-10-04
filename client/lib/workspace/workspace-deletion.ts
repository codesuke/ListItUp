import type { PrismaClient, Workspace } from "@/generated/prisma/client";

export type DeleteWorkspaceResult =
  | { status: "deleted" }
  | { status: "not-found" }
  | { status: "not-owner" }
  | { status: "personal-space" }
  | { status: "already-deleted" };

// The Restore Window (#74/#77): how long a deleted Workspace stays
// recoverable before it's eligible for purge (#79).
export const RESTORE_WINDOW_MONTHS = 3;

export function restoreWindowEndsAt(deletedAt: Date): Date {
  const endsAt = new Date(deletedAt);
  endsAt.setMonth(endsAt.getMonth() + RESTORE_WINDOW_MONTHS);
  return endsAt;
}

export type RestoreWorkspaceResult =
  | { status: "restored" }
  | { status: "not-found" }
  | { status: "not-owner" }
  | { status: "not-deleted" }
  | { status: "window-expired" };

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

// Owner-only restore within the Restore Window (#77). A Personal Space is
// never deletedAt in the first place, so it naturally falls out as
// "not-deleted" here rather than needing its own case.
export async function restoreWorkspace(
  database: PrismaClient,
  workspaceId: string,
  requestingUserId: string
): Promise<RestoreWorkspaceResult> {
  return database.$transaction(async (tx) => {
    const membership = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: requestingUserId } },
      include: { workspace: true },
    });

    if (!membership) {
      return { status: "not-found" };
    }

    if (membership.role !== "OWNER") {
      return { status: "not-owner" };
    }

    if (!membership.workspace.deletedAt) {
      return { status: "not-deleted" };
    }

    if (new Date() > restoreWindowEndsAt(membership.workspace.deletedAt)) {
      return { status: "window-expired" };
    }

    await tx.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: null, deletedByUserId: null },
    });

    return { status: "restored" };
  });
}

export type DeletedWorkspaceForOwner = {
  id: string;
  name: string;
  deletedAt: Date;
  restoreWindowEndsAt: Date;
};

// Backs the "Deleted Workspaces" list (#77) — only Workspaces the viewer
// owns, so a restore target can never be inferred for a Workspace they
// don't have authority over.
export async function listDeletedWorkspacesForOwner(
  database: PrismaClient,
  userId: string
): Promise<DeletedWorkspaceForOwner[]> {
  const memberships = await database.workspaceMember.findMany({
    where: { userId, role: "OWNER", workspace: { deletedAt: { not: null } } },
    include: { workspace: true },
    orderBy: { workspace: { deletedAt: "desc" } },
  });

  return memberships.map(({ workspace }) => toDeletedWorkspaceForOwner(workspace));
}

function toDeletedWorkspaceForOwner(workspace: Workspace): DeletedWorkspaceForOwner {
  // Narrowed by the `deletedAt: { not: null }` query filter above — Prisma's
  // generated type can't express that at the field level.
  const deletedAt = workspace.deletedAt!;
  return {
    id: workspace.id,
    name: workspace.name,
    deletedAt,
    restoreWindowEndsAt: restoreWindowEndsAt(deletedAt),
  };
}
