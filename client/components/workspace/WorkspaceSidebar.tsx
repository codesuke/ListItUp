"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  ChevronsUpDown,
  Home,
  LayoutList,
  ListChecks,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

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
  canManageWorkspaceSettings: boolean;
};

// A quiet left accent bar on the active item — not a tinted pill, in either
// color: this suppresses the sidebar primitive's own neutral data-active
// background fill and keeps only the orange inset accent plus the
// primitive's existing font-medium weight bump.
const ACTIVE_NAV_CLASSES = "data-active:bg-transparent data-active:shadow-[inset_2px_0_0_0_#ff6b4a]";

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
          className="bg-ink text-canvas text-[10px] font-semibold"
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
  canManageWorkspaceSettings,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isPersonalSpaceOpen, setIsPersonalSpaceOpen] = useState(false);

  const homeHref = `/workspaces/${currentWorkspaceId}`;
  const isHomeActive = pathname === homeHref;
  const isMyTasksActive = pathname.startsWith("/my-tasks");
  const isUpdatesActive = pathname.startsWith("/updates");
  const settingsHref = `/workspaces/${currentWorkspaceId}/settings`;
  const isSettingsActive = pathname.startsWith(settingsHref);
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
                href={`/updates?workspace=${currentWorkspaceId}`}
                isActive={isUpdatesActive}
                icon={<Bell />}
                label="Updates"
                badge={unreadNotificationCount}
              />
              {canManageWorkspaceSettings && (
                <NavMenuItem
                  href={settingsHref}
                  isActive={isSettingsActive}
                  icon={<Settings />}
                  label="Settings"
                />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {lists.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase tracking-wide">Lists</SidebarGroupLabel>
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
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/70 transition-colors duration-150 hover:text-sidebar-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform duration-150 ${isPersonalSpaceOpen ? "rotate-90" : ""}`}
            />
            Personal Space
          </button>

          {isPersonalSpaceOpen && personalSpace && (
            <SidebarGroupContent className="pl-2 animate-in fade-in-0 slide-in-from-top-1 duration-150">
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
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-sidebar-accent group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
              {initialsFromName(currentWorkspaceName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              {currentWorkspaceName}
            </span>
            <ChevronsUpDown
              className={`h-3.5 w-3.5 flex-shrink-0 text-sidebar-foreground/70 transition-transform duration-150 group-data-[collapsible=icon]:hidden ${isSwitcherOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isSwitcherOpen && (
            <ul className="absolute bottom-full left-0 z-10 mb-1 w-56 origin-bottom-left rounded-md border border-line bg-surface-2 py-1 shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-150">
              {switchableWorkspaces.length === 0 && (
                <li className="px-3 py-2 text-xs text-sidebar-foreground/70">No other Workspaces yet.</li>
              )}
              {switchableWorkspaces.map((workspace) => (
                <li key={workspace.id}>
                  <Link
                    href={`/workspaces/${workspace.id}`}
                    className={
                      workspace.id === currentWorkspaceId
                        ? "block px-3 py-2 text-sm text-[#ff8a70] transition-colors duration-150"
                        : "block px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-surface-3 hover:text-sidebar-foreground"
                    }
                  >
                    {workspace.name}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-line pt-1">
                <Link
                  href="/workspaces/new"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-surface-3 hover:text-sidebar-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Workspace
                </Link>
                <Link
                  href="/workspaces/deleted"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-surface-3 hover:text-sidebar-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Deleted Workspaces
                </Link>
              </li>
            </ul>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
