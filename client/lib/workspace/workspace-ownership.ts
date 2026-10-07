import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

// Confirmed with the repo owner during issue #20 (see docs/Specs-Planned/
// domain-model-schema-migration-and-permissions.md, Further Notes). Fixed
// by #88/#90: the outgoing Owner always lands on Admin, not configurable.
const OUTGOING_OWNER_ROLE: WorkspaceRole = "ADMIN";

// A Viewer must never hold ultimate authority, and the current Owner is
// already the Owner — both are refused as a transfer target (#88, #90).
// Exported so the Settings page's transfer-target picker can filter to the
// same eligible set instead of restating the rule.
const OWNERSHIP_ELIGIBLE_ROLES: WorkspaceRole[] = ["ADMIN", "MEMBER"];

export function isEligibleForOwnershipTransfer(role: WorkspaceRole): boolean {
  return OWNERSHIP_ELIGIBLE_ROLES.includes(role);
}

export type TransferWorkspaceOwnershipInput = {
  workspaceId: string;
  actingUserId: string;
  newOwnerUserId: string;
};

export type TransferWorkspaceOwnershipResult =
  | { status: "transferred" }
  | { status: "not-owner" }
  | { status: "personal-space" }
  | { status: "workspace-deleted" }
  | { status: "new-owner-not-a-member" }
  | { status: "new-owner-ineligible" };

// Hardened per #90: every authority check lives here, inside the same
// transaction as the mutation, so a caller that skips the Settings Server
// Action can't skip them too. The current Owner is identified from the
// acting User's own membership row rather than a generic "whoever is
// Owner" lookup, and the Workspace row is locked FOR UPDATE first (same
// parent-row-lock convention as lockAndCountSoleLeadLists) so two
// concurrent transfers on the same Workspace serialize instead of both
// reading "I am the Owner" before either commits.
export async function transferWorkspaceOwnership(
  database: PrismaClient,
  input: TransferWorkspaceOwnershipInput
): Promise<TransferWorkspaceOwnershipResult> {
  const { workspaceId, actingUserId, newOwnerUserId } = input;

  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "workspace" WHERE id = ${workspaceId} FOR UPDATE`;

    const actingMembership = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actingUserId } },
      include: { workspace: true },
    });

    if (!actingMembership || actingMembership.role !== "OWNER") {
      return { status: "not-owner" };
    }

    if (isDeletedWorkspace(actingMembership.workspace)) {
      return { status: "workspace-deleted" };
    }

    if (actingMembership.workspace.kind !== "SHARED") {
      return { status: "personal-space" };
    }

    const newOwnerMembership = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerUserId } },
    });

    if (!newOwnerMembership) {
      return { status: "new-owner-not-a-member" };
    }

    if (!isEligibleForOwnershipTransfer(newOwnerMembership.role)) {
      return { status: "new-owner-ineligible" };
    }

    await tx.workspaceMember.update({
      where: { id: actingMembership.id },
      data: { role: OUTGOING_OWNER_ROLE },
    });

    await tx.workspaceMember.update({
      where: { id: newOwnerMembership.id },
      data: { role: "OWNER" },
    });

    return { status: "transferred" };
  });
}
