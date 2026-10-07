import type { PrismaClient } from "@/generated/prisma/client";
import { canManageWorkspace } from "@/lib/permissions/workspace-access";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

export type SetPeerComparisonEnabledResult = { status: "updated" } | { status: "forbidden" };

// List Dashboard's Peer Comparison setting (#58): workspace-level, off by
// default, changeable only by a Workspace Owner or Admin — a List Lead
// managing that List's Roles/Description isn't enough here, since this
// setting affects every List in the Workspace at once.
export async function setPeerComparisonEnabled(
  database: PrismaClient,
  input: { userId: string; workspaceId: string; enabled: boolean }
): Promise<SetPeerComparisonEnabledResult> {
  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });

  if (!membership || isDeletedWorkspace(membership.workspace) || !canManageWorkspace(membership.role)) {
    return { status: "forbidden" };
  }

  await database.workspace.update({
    where: { id: input.workspaceId },
    data: { peerComparisonEnabled: input.enabled },
  });

  return { status: "updated" };
}
