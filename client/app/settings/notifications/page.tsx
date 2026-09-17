import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";

import { NotificationPreferencesForm } from "./NotificationPreferencesForm";
import { loadNotificationsPreferencesPageData } from "./page-data";

export default async function NotificationsSettingsPage() {
  const session = await requireAuthenticatedSession("/settings/notifications");

  const [data, workspaceId, unreadNotificationCount] = await Promise.all([
    loadNotificationsPreferencesPageData(prisma, session.user.id),
    resolveDefaultWorkspaceId(prisma, session.user.id),
    countUnreadNotifications(prisma, session.user.id),
  ]);

  if (!workspaceId) {
    notFound();
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, kind: true },
  });

  if (!workspace) {
    notFound();
  }

  return (
    <AppShell
      currentWorkspaceId={workspaceId}
      currentWorkspaceName={workspace.kind === "PERSONAL" ? "Personal Space" : workspace.name}
      userId={session.user.id}
    >
      <div className="flex min-h-screen flex-col">
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
          <div className="flex items-center gap-2">
            <a href="/updates" className="text-[13px] text-ink-faint hover:text-ink-muted">
              Updates
            </a>
            <ChevronRight className="h-3 w-3 text-ink-faint" />
            <span className="text-[13px] font-semibold text-ink">Manage Notifications</span>
          </div>
          <GlobalHeaderActions
            currentUserName={session.user.name}
            unreadNotificationCount={unreadNotificationCount}
          />
        </header>

        <main className="flex-1 bg-canvas px-10 pb-16 pt-8">
          <div className="mx-auto max-w-xl">
            <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight text-ink">
              Manage Notifications
            </h1>
            <p className="mb-8 text-[13px] text-ink-muted">
              Choose which changes notify you. Turning a type off stops new notifications of
              that kind from being created for you.
            </p>

            <NotificationPreferencesForm enabledByCategory={data.enabledByCategory} />
          </div>
        </main>
      </div>
    </AppShell>
  );
}
