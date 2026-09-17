"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { initialsFromName } from "@/lib/utils";

export function GlobalHeaderActions({
  currentUserName,
  unreadNotificationCount,
}: {
  currentUserName: string;
  unreadNotificationCount: number;
}) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      <ThemeToggle />

      <Link
        href="/updates"
        aria-label={
          unreadNotificationCount > 0
            ? `${unreadNotificationCount} unread notifications`
            : "Updates"
        }
        className="relative flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
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
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-2 bg-[#5b9dff] font-[family-name:var(--font-mono-label)] text-[10px] font-bold text-[#1a0800] hover:opacity-90"
      >
        {initialsFromName(currentUserName)}
      </Link>
    </div>
  );
}
