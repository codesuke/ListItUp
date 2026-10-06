import { randomUUID } from "node:crypto";

import type { PrismaClient, WorkspaceRole } from "@/generated/prisma/client";
import type { Mailer } from "@/lib/mailer/mailer-core";
import { workspaceMemberRemovedNoticeEmail } from "@/lib/mailer/email-templates/workspace-member-removed-notice";
import { workspaceRoleChangedNoticeEmail } from "@/lib/mailer/email-templates/workspace-role-changed-notice";

export type MembershipNotice =
  | { type: "removed" }
  | { type: "role-changed"; newRole: WorkspaceRole };

export interface NotifyWorkspaceMembershipChangeInput {
  recipientId: string;
  recipientEmail: string;
  actorUserId: string;
  actorName: string;
  workspaceId: string;
  workspaceName: string;
  notice: MembershipNotice;
}

// The shared prefactor for #91 (remove a member) and #92 (change a
// member's role, #89): one function creates the in-app Notification and
// sends the matching email, through the same mailer dependency-injection
// style as workspace-invitations.ts. mailer.send already swallows a
// delivery failure and returns { ok: false } rather than throwing (see
// mailer-core.ts), so a failed email can never roll back the membership
// change a caller already committed before calling this. A person who
// leaves voluntarily is never routed through here — callers only call this
// for an Owner/Admin-driven removal or role change (#88).
export async function notifyWorkspaceMembershipChange(
  database: PrismaClient,
  mailer: Mailer,
  input: NotifyWorkspaceMembershipChangeInput
): Promise<void> {
  const { recipientId, actorUserId, workspaceId, notice } = input;

  await database.notification.create({
    data: {
      id: randomUUID(),
      recipientId,
      actorId: actorUserId,
      workspaceId,
      type: notice.type === "removed" ? "WORKSPACE_MEMBER_REMOVED" : "WORKSPACE_ROLE_CHANGED",
      newRole: notice.type === "role-changed" ? notice.newRole : null,
    },
  });

  await mailer.send({
    to: input.recipientEmail,
    type: notice.type === "removed" ? "workspace-member-removed-notice" : "workspace-role-changed-notice",
    template:
      notice.type === "removed"
        ? workspaceMemberRemovedNoticeEmail({
            workspaceName: input.workspaceName,
            actorName: input.actorName,
          })
        : workspaceRoleChangedNoticeEmail({
            workspaceName: input.workspaceName,
            actorName: input.actorName,
            newRole: notice.newRole,
          }),
  });
}
