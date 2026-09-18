import { Archive, Bookmark } from "lucide-react";

import type { ActivityNotification } from "@/lib/notification/notification-inbox";
import { describeNotification } from "@/lib/notification/notification-inbox";

function formatNotificationTimestamp(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationRow({
  notification,
  boundOpen,
  boundToggleBookmark,
  boundArchive,
}: {
  notification: ActivityNotification;
  boundOpen: () => Promise<void>;
  boundToggleBookmark: () => Promise<void>;
  boundArchive: () => Promise<void>;
}) {
  return (
    <div className="flex items-start gap-1 rounded-[8px] px-1 py-1 transition-colors duration-150 hover:bg-surface-3">
      <form action={boundOpen} className="min-w-0 flex-1">
        <button type="submit" className="flex w-full items-start gap-3 rounded-[8px] px-2 py-1.5 text-left text-[13px]">
          <span
            className={
              notification.isUnread
                ? "mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#ff6b4a] transition-colors duration-150"
                : "mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-transparent transition-colors duration-150"
            }
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className={notification.isUnread ? "text-ink" : "text-ink-muted"}>
              {describeNotification(notification)}{" "}
            </span>
            <span className={notification.isUnread ? "font-medium text-ink" : "font-medium text-ink-muted"}>
              {notification.itemTitle}
            </span>
          </span>
          <span className="mt-0.5 flex-shrink-0 font-[family-name:var(--font-mono-label)] text-[10px] text-ink-faint">
            {formatNotificationTimestamp(notification.createdAt)}
          </span>
        </button>
      </form>

      <form action={boundToggleBookmark}>
        <button
          type="submit"
          aria-label={notification.isBookmarked ? "Remove bookmark" : "Bookmark"}
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] text-ink-faint transition-colors duration-150 hover:bg-surface-4 hover:text-ink"
        >
          <Bookmark
            className={
              notification.isBookmarked
                ? "h-3.5 w-3.5 fill-[#ff8a70] text-[#ff8a70] transition-colors duration-150"
                : "h-3.5 w-3.5 transition-colors duration-150"
            }
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
      </form>

      {!notification.isArchived && (
        <form action={boundArchive}>
          <button
            type="submit"
            aria-label="Archive"
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] text-ink-faint transition-colors duration-150 hover:bg-surface-4 hover:text-ink"
          >
            <Archive className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}

export function NotificationList({
  notifications,
  emptyMessage,
  boundOpen,
  boundToggleBookmark,
  boundArchive,
}: {
  notifications: ActivityNotification[];
  emptyMessage: string;
  boundOpen: (notificationId: string, itemHref: string) => () => Promise<void>;
  boundToggleBookmark: (notificationId: string) => () => Promise<void>;
  boundArchive: (notificationId: string) => () => Promise<void>;
}) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-line bg-surface-2 p-2">
      {notifications.map((notification) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          boundOpen={boundOpen(notification.id, notification.itemHref)}
          boundToggleBookmark={boundToggleBookmark(notification.id)}
          boundArchive={boundArchive(notification.id)}
        />
      ))}
    </div>
  );
}
