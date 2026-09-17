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
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
        <HomeBreadcrumb />
        <GlobalHeaderActions
          currentUserName={session.user.name}
          unreadNotificationCount={data.unreadNotificationCount}
        />
      </header>

      <main className="flex-1 bg-canvas px-10 pb-16 pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <div className="mb-2 font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.08em] text-[#ff8a70]">
              {dateLabel}
            </div>
            <h1 className="text-[32px] font-semibold tracking-tight text-ink">
              {greeting}, {session.user.name}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {timeLabel} — {data.workspaceName}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2">
              <MyTasksPreviewWidget
                items={data.myTasksPreview}
                workspaceId={workspaceId}
                workspaceName={data.workspaceName}
                viewerName={session.user.name}
                now={now}
              />
            </div>
            <RecentListsWidget lists={data.recentLists} workspaceId={workspaceId} />
            <div className="col-span-3">
              <AssignedByMeWidget items={data.assignedByMe} workspaceId={workspaceId} now={now} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
