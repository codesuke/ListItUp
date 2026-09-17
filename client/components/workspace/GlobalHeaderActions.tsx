"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { initialsFromName } from "@/lib/utils";

// Shared visual + interaction treatment for the square icon buttons in this
// row (Search, Bell) so they read as one consistent group with ThemeToggle,
// which carries the same classes itself.
const ICON_BUTTON_CLASSES =
  "flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

export function GlobalHeaderActions({
  currentUserName,
  unreadNotificationCount,
}: {
  currentUserName: string;
  unreadNotificationCount: number;
}) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Search"
        title="Search — coming soon"
        className={ICON_BUTTON_CLASSES}
      >
        <Search className="h-[15px] w-[15px]" />
      </button>

      <ThemeToggle />

      <Link
        href="/updates"
        aria-label={
          unreadNotificationCount > 0
            ? `${unreadNotificationCount} unread notifications`
            : "Updates"
        }
        className={`relative ${ICON_BUTTON_CLASSES}`}
      >
        <Bell className="h-[15px] w-[15px]" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6b4a] px-1 font-[family-name:var(--font-mono-label)] text-[9px] font-bold text-[#1a0800]">
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        )}
      </Link>

      <Link
        href="/profile"
        aria-label="View profile"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-2 bg-[#5b9dff] font-[family-name:var(--font-mono-label)] text-[10px] font-bold text-[#1a0800] hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
      >
        {initialsFromName(currentUserName)}
      </Link>
    </div>
  );
}
