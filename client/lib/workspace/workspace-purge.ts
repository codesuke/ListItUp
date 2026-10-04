import type { PrismaClient } from "@/generated/prisma/client";
import type { Mailer } from "@/lib/mailer/mailer-core";
import { recordSecurityEvent } from "@/lib/security/platform-operations";
import { notifyOwnerOfUpcomingPurge } from "@/lib/workspace/workspace-deletion-notifications";
import { restoreWindowEndsAt } from "@/lib/workspace/workspace-deletion";

// How long before the Restore Window ends the Owner is warned (#79). A
// single named constant, same style as RESTORE_WINDOW_MONTHS.
export const PURGE_WARNING_LEAD_TIME_DAYS = 7;

function purgeWarningDueAt(restoreWindowEnd: Date): Date {
  const dueAt = new Date(restoreWindowEnd);
  dueAt.setDate(dueAt.getDate() - PURGE_WARNING_LEAD_TIME_DAYS);
  return dueAt;
}

// Removing an Attachment's stored object is a side effect the Workspace
// hard-delete's DB cascade can never reach (ADR 0002) — injected so the
// integration-test seam can fake it instead of touching real object
// storage.
export interface AttachmentObjectStore {
  deleteObject(storageKey: string): Promise<void>;
}

export interface PurgeExpiredWorkspacesResult {
  purgedWorkspaceIds: string[];
  warnedWorkspaceIds: string[];
}

// Scheduled sweep (#79) over every Deleted Workspace still in the
// database: past its Restore Window it is purged for good; close to the
// end of its Restore Window its Owner is warned once. Workspaces still
// well inside the window, and active Workspaces (excluded by the
// deletedAt filter), are left untouched.
export async function purgeExpiredWorkspaces(
  database: PrismaClient,
  dependencies: { mailer: Mailer; objectStore: AttachmentObjectStore },
  now: Date = new Date()
): Promise<PurgeExpiredWorkspacesResult> {
  const deletedWorkspaces = await database.workspace.findMany({
    where: { deletedAt: { not: null } },
    include: { members: { where: { role: "OWNER" }, include: { user: true } } },
  });

  const purgedWorkspaceIds: string[] = [];
  const warnedWorkspaceIds: string[] = [];

  for (const workspace of deletedWorkspaces) {
    // Narrowed by the `deletedAt: { not: null }` query filter above —
    // Prisma's generated type can't express that at the field level.
    const deletedAt = workspace.deletedAt!;
    const restoreWindowEnd = restoreWindowEndsAt(deletedAt);
    const owner = workspace.members[0];

    if (now >= restoreWindowEnd) {
      await purgeWorkspace(database, dependencies.objectStore, workspace.id);
      await recordSecurityEvent(database, {
        type: "workspace-purged",
        userId: owner?.userId,
      });
      purgedWorkspaceIds.push(workspace.id);
      continue;
    }

    const shouldWarn =
      !workspace.purgeWarningSentAt && now >= purgeWarningDueAt(restoreWindowEnd) && owner !== undefined;

    if (shouldWarn) {
      await notifyOwnerOfUpcomingPurge(dependencies.mailer, {
        ownerEmail: owner.user.email,
        workspaceName: workspace.name,
        purgeDate: restoreWindowEnd,
      });
      await database.workspace.update({
        where: { id: workspace.id },
        data: { purgeWarningSentAt: now },
      });
      warnedWorkspaceIds.push(workspace.id);
    }
  }

  return { purgedWorkspaceIds, warnedWorkspaceIds };
}

async function purgeWorkspace(
  database: PrismaClient,
  objectStore: AttachmentObjectStore,
  workspaceId: string
): Promise<void> {
  const attachments = await database.attachment.findMany({
    where: { item: { list: { workspaceId } } },
    select: { storageKey: true },
  });

  await Promise.all(attachments.map((attachment) => objectStore.deleteObject(attachment.storageKey)));

  // Lists, Items, members, invitations and labels all cascade from this
  // one delete (prisma/schema.prisma) — only the object-storage side
  // effect above needs to be handled separately.
  await database.workspace.delete({ where: { id: workspaceId } });
}
