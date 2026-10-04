import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import { canAccessWorkspaceSettings } from "@/lib/permissions/workspace-access";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

// A Workspace Member is invited as MEMBER or VIEWER (see
// workspace-invitations.ts) and promoted to ADMIN, or demoted back, after
// joining (docs/QnA/listitup-gap-grilling.md's "role changes happen after
// joining" decision). OWNER is excluded both as a target role and as a
// role a target member can currently hold — that transition belongs to
// transferWorkspaceOwnership, not this one.
export type AssignableWorkspaceRole = Extract<WorkspaceRole, "ADMIN" | "MEMBER" | "VIEWER">;

export function isAssignableWorkspaceRole(role: string): role is AssignableWorkspaceRole {
  return role === "ADMIN" || role === "MEMBER" || role === "VIEWER";
}

export interface UpdateWorkspaceMemberRoleInput {
  workspaceId: string;
  actingUserId: string;
  targetUserId: string;
  role: string;
}

export type UpdateWorkspaceMemberRoleResult =
  | { status: "updated" }
  | { status: "forbidden" }
  | { status: "invalid-role" }
  | { status: "not-found" }
  | { status: "cannot-change-owner" };

// Authorization and role validation happen here, not just on the Members
// page's controls — a Server Action calling this is not itself a security
// boundary (see docs/agents/nextjs-conventions.md, matching
// workspace-invitations.ts's identical rationale).
export async function updateWorkspaceMemberRole(
  database: PrismaClient,
  input: UpdateWorkspaceMemberRoleInput
): Promise<UpdateWorkspaceMemberRoleResult> {
  const [actingMembership, targetMembership] = await Promise.all([
    database.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: input.workspaceId, userId: input.actingUserId },
      },
      include: { workspace: true },
    }),
    database.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: input.workspaceId, userId: input.targetUserId },
      },
    }),
  ]);

  if (
    !actingMembership ||
    isDeletedWorkspace(actingMembership.workspace) ||
    !canAccessWorkspaceSettings({
      role: actingMembership.role,
      workspaceKind: actingMembership.workspace.kind,
    })
  ) {
    return { status: "forbidden" };
  }

  if (!targetMembership) {
    return { status: "not-found" };
  }

  if (targetMembership.role === "OWNER") {
    return { status: "cannot-change-owner" };
  }

  if (!isAssignableWorkspaceRole(input.role)) {
    return { status: "invalid-role" };
  }

  await database.workspaceMember.update({
    where: {
      workspaceId_userId: { workspaceId: input.workspaceId, userId: input.targetUserId },
    },
    data: { role: input.role },
  });

  return { status: "updated" };
}
