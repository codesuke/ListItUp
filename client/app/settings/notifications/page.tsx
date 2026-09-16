import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";

import { NotificationPreferencesForm } from "./NotificationPreferencesForm";
import { loadNotificationsPreferencesPageData } from "./page-data";

export default async function NotificationsSettingsPage() {
  const session = await requireAuthenticatedSession("/settings/notifications");

  const [data, workspaceId] = await Promise.all([
    loadNotificationsPreferencesPageData(prisma, session.user.id),
    resolveDefaultWorkspaceId(prisma, session.user.id),
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
      currentUserName={session.user.name}
      userId={session.user.id}
    >
      <div className="flex min-h-screen flex-col">
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-[#232323] bg-[#0d0d0d] px-7">
          <div className="flex items-center gap-2">
            <a href="/updates" className="text-[13px] text-[#5a5a56] hover:text-[#8f8f8a]">
              Updates
            </a>
            <ChevronRight className="h-3 w-3 text-[#5a5a56]" />
            <span className="text-[13px] font-semibold text-[#e5e5e0]">Manage Notifications</span>
          </div>
        </header>

        <main className="flex-1 bg-[#080808] px-10 pb-16 pt-8">
          <div className="mx-auto max-w-xl">
            <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight text-[#e5e5e0]">
              Manage Notifications
            </h1>
            <p className="mb-8 text-[13px] text-[#8f8f8a]">
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
