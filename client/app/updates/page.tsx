import { Activity, Archive, AtSign, Bookmark, Settings } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { StatusBadge } from "@/components/workspace/StatusBadge";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import type { ActivityCategory } from "@/lib/notification/notification-inbox";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";
import { isDeletedWorkspace } from "@/lib/workspace/workspace-visibility";

import { NotificationList } from "./NotificationList";
import { archiveNotificationAction, openNotificationAction, toggleBookmarkAction } from "./actions";
import { loadUpdatesPageData, type UpdatesTab } from "./page-data";

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  assignee: "Assignee",
  notes: "Notes",
  mentions: "Mentions",
  state: "State",
};

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ActivityCategory[];

function isActivityCategory(value: string | undefined): value is ActivityCategory {
  return value !== undefined && (CATEGORIES as string[]).includes(value);
}

const TABS: { key: UpdatesTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "activity", label: "Activity", icon: Activity },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "archive", label: "Archive", icon: Archive },
  { key: "mentioned", label: "@Mentioned", icon: AtSign },
];

const TAB_KEYS: readonly string[] = TABS.map((tab) => tab.key);

function isTabKey(value: string): value is UpdatesTab {
  return TAB_KEYS.includes(value);
}

const EMPTY_MESSAGE: Record<UpdatesTab, string> = {
  activity: "Nothing here yet.",
  bookmarks: "You haven't bookmarked anything yet.",
  archive: "Nothing archived yet.",
  mentioned: "No mentions yet.",
};

const CHIP_BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 font-[family-name:var(--font-mono-label)] text-[10.5px] tracking-[0.04em] transition-colors duration-150";
const CHIP_ACTIVE = `${CHIP_BASE} border-[#ff6b4a] bg-[#ff6b4a24] text-[#ff8a70]`;
const CHIP_INACTIVE = `${CHIP_BASE} border-line-strong bg-surface-3 text-ink-muted hover:text-ink`;

type Query = { tab?: string; category?: string; workspace?: string };
type Props = { searchParams: Promise<Query> };

function updatesHref(query: Query): string {
  const params = new URLSearchParams();
  if (query.tab && query.tab !== "activity") params.set("tab", query.tab);
  if (query.category) params.set("category", query.category);
  if (query.workspace) params.set("workspace", query.workspace);
  const search = params.toString();
  return search ? `/updates?${search}` : "/updates";
}

export default async function UpdatesPage({ searchParams }: Props) {
  const session = await requireAuthenticatedSession("/updates");
  const query = await searchParams;
  const tab: UpdatesTab = query.tab && isTabKey(query.tab) ? query.tab : "activity";
  const category = tab === "activity" && isActivityCategory(query.category) ? query.category : undefined;

  // The Workspace the sidebar/topbar shell renders as "current": the
  // explicitly requested one if the User is actually a member of it (same
  // membership check as the /workspaces/[workspaceId] layout), else the
  // same oldest-SHARED-else-Personal-Space fallback as the root landing
  // page — Updates is cross-Workspace, so there's no URL segment to source
  // this from the way /workspaces/[id] pages do. A Deleted Workspace is
  // treated the same as "not a member" here (#76), falling back rather than
  // 404ing since Updates isn't scoped to one Workspace the way /workspaces/
  // [id] pages are.
  const requestedMembership = query.workspace
    ? await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: query.workspace, userId: session.user.id } },
        include: { workspace: true },
      })
    : null;
  const shellWorkspaceId =
    requestedMembership && !isDeletedWorkspace(requestedMembership.workspace)
      ? requestedMembership.workspaceId
      : await resolveDefaultWorkspaceId(prisma, session.user.id);
  if (!shellWorkspaceId) {
    notFound();
  }
  const shellWorkspace =
    requestedMembership && !isDeletedWorkspace(requestedMembership.workspace)
      ? requestedMembership.workspace
      : await prisma.workspace.findUnique({
          where: { id: shellWorkspaceId },
          select: { name: true, kind: true },
        });
  if (!shellWorkspace) {
    notFound();
  }

  const data = await loadUpdatesPageData(prisma, { userId: session.user.id, tab, category });

  const boundOpen = (notificationId: string, itemHref: string) =>
    openNotificationAction.bind(null, notificationId, itemHref);
  const boundToggleBookmark = (notificationId: string) => toggleBookmarkAction.bind(null, notificationId);
  const boundArchive = (notificationId: string) => archiveNotificationAction.bind(null, notificationId);

  return (
    <AppShell
      currentWorkspaceId={shellWorkspaceId}
      currentWorkspaceName={shellWorkspace.kind === "PERSONAL" ? "Personal Space" : shellWorkspace.name}
      userId={session.user.id}
    >
      <div className="flex flex-col animate-in fade-in duration-200">
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">Updates</span>
            {data.unreadCount > 0 && <StatusBadge tone="red">{data.unreadCount} unread</StatusBadge>}
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/settings/notifications?workspace=${shellWorkspaceId}`}
              className="flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
              Manage Notifications
            </a>
            <GlobalHeaderActions
              currentUserName={session.user.name}
              unreadNotificationCount={data.unreadCount}
              workspaceId={shellWorkspaceId}
            />
          </div>
        </header>

        <main className="bg-canvas px-10 pb-16 pt-8">
          <div className="mx-auto max-w-6xl">
            <nav className="mb-5 flex flex-wrap items-center gap-6 border-b border-line">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <a
                    key={t.key}
                    href={updatesHref({ tab: t.key === "activity" ? undefined : t.key, workspace: query.workspace })}
                    className={
                      tab === t.key
                        ? "flex items-center gap-1.5 border-b-2 border-[#ff6b4a] py-3 text-[13px] font-semibold text-ink transition-colors duration-150"
                        : "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-semibold text-ink-muted transition-colors duration-150 hover:text-ink"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </a>
                );
              })}
            </nav>

            {tab === "activity" && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <a href={updatesHref({ workspace: query.workspace })} className={!category ? CHIP_ACTIVE : CHIP_INACTIVE}>
                  All
                </a>
                {CATEGORIES.map((c) => (
                  <a
                    key={c}
                    href={updatesHref({ category: c, workspace: query.workspace })}
                    className={category === c ? CHIP_ACTIVE : CHIP_INACTIVE}
                  >
                    {CATEGORY_LABEL[c]}
                  </a>
                ))}
              </div>
            )}

            <NotificationList
              notifications={data.notifications}
              emptyMessage={EMPTY_MESSAGE[tab]}
              boundOpen={boundOpen}
              boundToggleBookmark={boundToggleBookmark}
              boundArchive={boundArchive}
            />
          </div>
        </main>
      </div>
    </AppShell>
  );
}
