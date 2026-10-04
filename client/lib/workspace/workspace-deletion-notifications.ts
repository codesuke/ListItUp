import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailMessageType, Mailer } from "@/lib/mailer/mailer-core";
import type { EmailTemplate } from "@/lib/mailer/email-templates/render";
import {
  workspaceDeletedNoticeEmail,
  workspaceRestoredNoticeEmail,
} from "@/lib/mailer/email-templates/workspace-deletion-notice";
import { restoreWindowEndsAt } from "@/lib/workspace/workspace-deletion";

// Fans the same rendered template out to every other member. A mail
// failure is swallowed by `mailer.send` itself (#78) — it must never affect
// the already-committed delete/restore, so callers don't need to inspect
// the results here.
async function notifyOtherMembers(
  database: PrismaClient,
  mailer: Mailer,
  options: {
    workspaceId: string;
    excludeUserId: string;
    type: EmailMessageType;
    template: EmailTemplate;
  }
): Promise<void> {
  const otherMembers = await database.workspaceMember.findMany({
    where: { workspaceId: options.workspaceId, userId: { not: options.excludeUserId } },
    include: { user: true },
  });

  await Promise.all(
    otherMembers.map((member) =>
      mailer.send({ to: member.user.email, type: options.type, template: options.template })
    )
  );
}

export interface NotifyMembersOfWorkspaceDeletionParams {
  workspaceId: string;
  workspaceName: string;
  deletedByUserId: string;
  deletedByName: string;
  deletedAt: Date;
}

// Members are told when their Workspace is deleted (#78): every other
// member is emailed naming the Owner who deleted it and the Restore Window
// deadline.
export async function notifyMembersOfWorkspaceDeletion(
  database: PrismaClient,
  mailer: Mailer,
  params: NotifyMembersOfWorkspaceDeletionParams
): Promise<void> {
  await notifyOtherMembers(database, mailer, {
    workspaceId: params.workspaceId,
    excludeUserId: params.deletedByUserId,
    type: "workspace-deleted-notice",
    template: workspaceDeletedNoticeEmail({
      workspaceName: params.workspaceName,
      deletedByName: params.deletedByName,
      restoreDeadline: restoreWindowEndsAt(params.deletedAt),
    }),
  });
}

export interface NotifyMembersOfWorkspaceRestorationParams {
  workspaceId: string;
  workspaceName: string;
  restoredByUserId: string;
}

// Members are told when their Workspace is restored (#78): every other
// member is emailed that access is back.
export async function notifyMembersOfWorkspaceRestoration(
  database: PrismaClient,
  mailer: Mailer,
  params: NotifyMembersOfWorkspaceRestorationParams
): Promise<void> {
  await notifyOtherMembers(database, mailer, {
    workspaceId: params.workspaceId,
    excludeUserId: params.restoredByUserId,
    type: "workspace-restored-notice",
    template: workspaceRestoredNoticeEmail({ workspaceName: params.workspaceName }),
  });
}
