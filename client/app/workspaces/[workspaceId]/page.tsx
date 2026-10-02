import { notFound } from "next/navigation";

import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { HomeBreadcrumb } from "@/components/workspace/HomeBreadcrumb";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { greetingForHour } from "./greeting";
import { AssignedByMeWidget, MyTasksPreviewWidget, RecentListsWidget } from "./HomeWidgets";
import { loadHomePageData } from "./page-data";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}`);

  const now = new Date();
  const data = await loadHomePageData(prisma, { userId: session.user.id, workspaceId, now });

  if (!data) {
    notFound();
  }

  const greeting = greetingForHour(now.getHours());
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex min-h-screen flex-col animate-in fade-in duration-200">
      <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
        <HomeBreadcrumb />
        <GlobalHeaderActions
          currentUserName={session.user.name}
          unreadNotificationCount={data.unreadNotificationCount}
          workspaceId={workspaceId}
        />
      </header>

      <main className="flex-1 bg-canvas px-10 pb-16 pt-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {greeting}, {session.user.name}
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              {dateLabel} · {timeLabel} · {data.workspaceName}
            </p>
          </div>

          <MyTasksPreviewWidget items={data.myTasksPreview} workspaceId={workspaceId} now={now} />

          <div className="mt-14 grid grid-cols-2 gap-x-12 gap-y-10 border-t border-line pt-10">
            <RecentListsWidget lists={data.recentLists} workspaceId={workspaceId} />
            <AssignedByMeWidget items={data.assignedByMe} workspaceId={workspaceId} now={now} />
          </div>
        </div>
      </main>
    </div>
  );
}
