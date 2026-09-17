"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, ChevronsUpDown, Home, LayoutList, ListChecks } from "lucide-react";

import type { WorkspaceNavEntry } from "@/app/workspaces/[workspaceId]/layout-data";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { initialsFromName } from "@/lib/utils";

type WorkspaceSidebarProps = {
  currentWorkspaceId: string;
  currentWorkspaceName: string;
  switchableWorkspaces: WorkspaceNavEntry[];
  personalSpace: WorkspaceNavEntry | null;
  unreadNotificationCount: number;
  lists: WorkspaceNavEntry[];
};

// Preserves the brand-orange active treatment from DESIGN.md; the base
// sidebar primitive's own data-active classes use the neutral --sidebar-accent
// token, which twMerge lets us override per data-active/hover state here.
const ACTIVE_NAV_CLASSES =
  "data-active:bg-[#ff6b4a24] data-active:text-[#ff8a70] data-active:hover:bg-[#ff6b4a24] data-active:hover:text-[#ff8a70]";

function NavMenuItem({
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
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={label}
        className={ACTIVE_NAV_CLASSES}
        render={<Link href={href} />}
      >
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
      {badge !== undefined && badge > 0 && (
        <SidebarMenuBadge
          aria-label={`${badge} unread notifications`}
          className="bg-[#ff6b4a] text-[#1a0800] font-[family-name:var(--font-mono-label)] text-[10px] font-bold"
        >
          {badge > 99 ? "99+" : badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

export function WorkspaceSidebar({
  currentWorkspaceId,
  currentWorkspaceName,
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <Logo href={homeHref} />
          <SidebarTrigger className="text-ink-faint hover:bg-surface-3 hover:text-ink" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavMenuItem href={homeHref} isActive={isHomeActive} icon={<Home />} label="Home" />
              <NavMenuItem
                href={`/my-tasks?workspace=${currentWorkspaceId}`}
                isActive={isMyTasksActive}
                icon={<ListChecks />}
                label="My Tasks"
              />
              <NavMenuItem
                href="/updates"
                isActive={isUpdatesActive}
                icon={<Bell />}
                label="Updates"
                badge={unreadNotificationCount}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {lists.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-[family-name:var(--font-mono-label)] uppercase tracking-[0.14em]">
              Lists
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {lists.map((list) => (
                  <NavMenuItem
                    key={list.id}
                    href={listHref(list.id)}
                    isActive={pathname.startsWith(listHref(list.id))}
                    icon={<LayoutList />}
                    label={list.name}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={() => setIsPersonalSpaceOpen((open) => !open)}
            aria-expanded={isPersonalSpaceOpen}
            disabled={!personalSpace}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 font-[family-name:var(--font-mono-label)] text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/70 hover:text-sidebar-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPersonalSpaceOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Personal Space
          </button>

          {isPersonalSpaceOpen && personalSpace && (
            <SidebarGroupContent className="pl-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href={`/workspaces/${personalSpace.id}`} />}>
                    <span>{personalSpace.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSwitcherOpen((open) => !open)}
            aria-expanded={isSwitcherOpen}
            aria-label="Switch Workspace"
            className="flex w-full items-center gap-2.5 rounded-[8px] border border-sidebar-border bg-surface-2 px-2.5 py-2.5 text-left hover:border-line-strong hover:bg-surface-3"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#ff6b4a] font-[family-name:var(--font-mono-label)] text-xs font-bold text-[#1a0800]">
              {initialsFromName(currentWorkspaceName)}
            </span>
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-[13px] font-semibold text-sidebar-foreground">
                {currentWorkspaceName}
              </span>
              <span className="block font-[family-name:var(--font-mono-label)] text-[9px] uppercase tracking-[0.08em] text-sidebar-foreground/70">
                Workspace
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden" />
          </button>

          {isSwitcherOpen && (
            <ul className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-md border border-sidebar-border bg-surface-2 py-1 shadow-lg">
              {switchableWorkspaces.length === 0 && (
                <li className="px-3 py-2 text-xs text-sidebar-foreground/70">No other Workspaces yet.</li>
              )}
              {switchableWorkspaces.map((workspace) => (
                <li key={workspace.id}>
                  <Link
                    href={`/workspaces/${workspace.id}`}
                    className={
                      workspace.id === currentWorkspaceId
                        ? "block px-3 py-2 text-sm text-[#ff8a70]"
                        : "block px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-surface-3 hover:text-sidebar-foreground"
                    }
                  >
                    {workspace.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
