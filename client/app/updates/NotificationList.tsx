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
    <div className="flex items-start gap-1 rounded-[8px] px-1 py-1 hover:bg-[#1a1a1a]">
      <form action={boundOpen} className="min-w-0 flex-1">
        <button type="submit" className="flex w-full items-start gap-3 rounded-[8px] px-2 py-1.5 text-left text-[13px]">
          <span
            className={
              notification.isUnread
                ? "mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#ff6b4a]"
                : "mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-transparent"
            }
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className={notification.isUnread ? "text-[#e5e5e0]" : "text-[#8f8f8a]"}>
              {describeNotification(notification)}{" "}
            </span>
            <span className={notification.isUnread ? "font-medium text-[#e5e5e0]" : "font-medium text-[#8f8f8a]"}>
              {notification.itemTitle}
            </span>
          </span>
          <span className="mt-0.5 flex-shrink-0 font-[family-name:var(--font-mono-label)] text-[10px] text-[#5a5a56]">
            {formatNotificationTimestamp(notification.createdAt)}
          </span>
        </button>
      </form>

      <form action={boundToggleBookmark}>
        <button
          type="submit"
          aria-label={notification.isBookmarked ? "Remove bookmark" : "Bookmark"}
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] text-[#5a5a56] hover:bg-[#202020] hover:text-[#e5e5e0]"
        >
          <Bookmark
            className={notification.isBookmarked ? "h-3.5 w-3.5 fill-[#ff8a70] text-[#ff8a70]" : "h-3.5 w-3.5"}
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
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] text-[#5a5a56] hover:bg-[#202020] hover:text-[#e5e5e0]"
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
      <div className="rounded-[12px] border border-dashed border-[#232323] px-4 py-16 text-center text-sm text-[#5a5a56]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-[#232323] bg-[#141414] p-2">
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
