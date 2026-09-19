import { Activity, Archive, AtSign, Bookmark, Settings } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { StatusBadge } from "@/components/workspace/StatusBadge";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import type { ActivityCategory } from "@/lib/notification/notification-inbox";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";

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

type Query = { tab?: string; category?: string };
type Props = { searchParams: Promise<Query> };

function updatesHref(query: Query): string {
  const params = new URLSearchParams();
  if (query.tab && query.tab !== "activity") params.set("tab", query.tab);
  if (query.category) params.set("category", query.category);
  const search = params.toString();
  return search ? `/updates?${search}` : "/updates";
}

export default async function UpdatesPage({ searchParams }: Props) {
  const session = await requireAuthenticatedSession("/updates");
  const query = await searchParams;
  const tab: UpdatesTab = query.tab && isTabKey(query.tab) ? query.tab : "activity";
  const category = tab === "activity" && isActivityCategory(query.category) ? query.category : undefined;

  const defaultWorkspaceId = await resolveDefaultWorkspaceId(prisma, session.user.id);
  if (!defaultWorkspaceId) {
    notFound();
  }
  const shellWorkspace = await prisma.workspace.findUnique({
    where: { id: defaultWorkspaceId },
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
      currentWorkspaceId={defaultWorkspaceId}
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
              href="/settings/notifications"
              className="flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
              Manage Notifications
            </a>
            <GlobalHeaderActions
              currentUserName={session.user.name}
              unreadNotificationCount={data.unreadCount}
            />
          </div>
        </header>

        <main className="bg-canvas px-10 pb-16 pt-8">
          <div className="mx-auto max-w-3xl">
            <nav className="mb-5 flex flex-wrap items-center gap-6 border-b border-line">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <a
                    key={t.key}
                    href={updatesHref({ tab: t.key === "activity" ? undefined : t.key })}
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
                <a href={updatesHref({})} className={!category ? CHIP_ACTIVE : CHIP_INACTIVE}>
                  All
                </a>
                {CATEGORIES.map((c) => (
                  <a key={c} href={updatesHref({ category: c })} className={category === c ? CHIP_ACTIVE : CHIP_INACTIVE}>
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
