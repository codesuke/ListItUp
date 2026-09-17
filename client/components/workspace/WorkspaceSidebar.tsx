"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, ChevronsUpDown, Home, LayoutList, ListChecks } from "lucide-react";

import type { WorkspaceNavEntry } from "@/app/workspaces/[workspaceId]/layout-data";
import { ThemeToggle } from "@/components/theme-toggle";

type WorkspaceSidebarProps = {
  currentWorkspaceId: string;
  currentWorkspaceName: string;
  currentUserName: string;
  switchableWorkspaces: WorkspaceNavEntry[];
  personalSpace: WorkspaceNavEntry | null;
  unreadNotificationCount: number;
  lists: WorkspaceNavEntry[];
};

function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function NavLink({
  href,
  isActive,
  icon,
  label,
  badge,
}: {
  href: string;
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? "flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13.5px] font-medium bg-[#ff6b4a24] text-[#ff8a70]"
          : "flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13.5px] font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
      }
    >
      <span className={isActive ? "text-[#ff8a70]" : "text-ink-faint"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          aria-label={`${badge} unread notifications`}
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6b4a] px-1 font-[family-name:var(--font-mono-label)] text-[10px] font-bold text-[#1a0800]"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export function WorkspaceSidebar({
  currentWorkspaceId,
  currentWorkspaceName,
  currentUserName,
  switchableWorkspaces,
  personalSpace,
  unreadNotificationCount,
  lists,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isPersonalSpaceOpen, setIsPersonalSpaceOpen] = useState(false);

  const homeHref = `/workspaces/${currentWorkspaceId}`;
  const isHomeActive = pathname === homeHref;
  const isMyTasksActive = pathname.startsWith("/my-tasks");
  const isUpdatesActive = pathname.startsWith("/updates");
  const listHref = (listId: string) => `/workspaces/${currentWorkspaceId}/lists/${listId}`;

  return (
    <aside className="flex w-[264px] flex-shrink-0 flex-col gap-1 border-r border-line bg-surface-1 px-3 py-4">
      <div className="relative mb-2">
        <button
          type="button"
          onClick={() => setIsSwitcherOpen((open) => !open)}
          aria-expanded={isSwitcherOpen}
          aria-label="Switch Workspace"
          className="flex w-full items-center gap-2.5 rounded-[8px] border border-line bg-surface-2 px-2.5 py-2.5 text-left hover:border-line-strong hover:bg-surface-3"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#ff6b4a] font-[family-name:var(--font-mono-label)] text-xs font-bold text-[#1a0800]">
            {initialsFromName(currentWorkspaceName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">
              {currentWorkspaceName}
            </span>
            <span className="block font-[family-name:var(--font-mono-label)] text-[9px] uppercase tracking-[0.08em] text-ink-faint">
              Workspace
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
        </button>

        {isSwitcherOpen && (
          <ul className="absolute left-0 right-0 z-10 mt-1 rounded-md border border-line bg-surface-2 py-1 shadow-lg">
            {switchableWorkspaces.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-faint">No other Workspaces yet.</li>
            )}
            {switchableWorkspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  href={`/workspaces/${workspace.id}`}
                  className={
                    workspace.id === currentWorkspaceId
                      ? "block px-3 py-2 text-sm text-[#ff8a70]"
                      : "block px-3 py-2 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
                  }
                >
                  {workspace.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavLink href={homeHref} isActive={isHomeActive} icon={<Home className="h-4 w-4" />} label="Home" />
        <NavLink
          href={`/my-tasks?workspace=${currentWorkspaceId}`}
          isActive={isMyTasksActive}
          icon={<ListChecks className="h-4 w-4" />}
          label="My Tasks"
        />
        <NavLink
          href="/updates"
          isActive={isUpdatesActive}
          icon={<Bell className="h-4 w-4" />}
          label="Updates"
          badge={unreadNotificationCount}
        />
      </nav>

      {lists.length > 0 && (
        <nav className="flex flex-col gap-0.5">
          <div className="px-2.5 pb-1.5 pt-4 font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Lists
          </div>
          {lists.map((list) => (
            <NavLink
              key={list.id}
              href={listHref(list.id)}
              isActive={pathname.startsWith(listHref(list.id))}
              icon={<LayoutList className="h-4 w-4" />}
              label={list.name}
            />
          ))}
        </nav>
      )}

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setIsPersonalSpaceOpen((open) => !open)}
          aria-expanded={isPersonalSpaceOpen}
          disabled={!personalSpace}
          className="flex w-full items-center gap-1.5 rounded-md px-2.5 pb-1.5 pt-4 font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPersonalSpaceOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Personal Space
        </button>

        {isPersonalSpaceOpen && personalSpace && (
          <div className="flex flex-col gap-0.5 pl-2">
            <Link
              href={`/workspaces/${personalSpace.id}`}
              className="rounded-md px-2.5 py-1.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
            >
              {personalSpace.name}
            </Link>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2.5 pt-4">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-2 bg-[#5b9dff] font-[family-name:var(--font-mono-label)] text-[10px] font-bold text-[#1a0800]">
          {initialsFromName(currentUserName)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-muted">{currentUserName}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
