"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { SearchPalette } from "@/components/workspace/SearchPalette";
import { initialsFromName } from "@/lib/utils";

// Shared visual + interaction treatment for the square icon buttons in this
// row (Search, Bell) so they read as one consistent group with ThemeToggle,
// which carries the same classes itself.
const ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

export function GlobalHeaderActions({
  currentUserName,
  unreadNotificationCount,
  workspaceId,
}: {
  currentUserName: string;
  unreadNotificationCount: number;
  workspaceId: string;
}) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <SearchPalette workspaceId={workspaceId} triggerClassName={ICON_BUTTON_CLASSES} />

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
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-semibold text-canvas">
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        )}
      </Link>

      <Link
        href="/profile"
        aria-label="View profile"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5b9dff] text-[11px] font-semibold text-[#1a0800] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
      >
        {initialsFromName(currentUserName)}
      </Link>
    </div>
  );
}
