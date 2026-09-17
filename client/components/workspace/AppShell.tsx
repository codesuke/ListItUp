import { JetBrains_Mono, Inter } from "next/font/google";

import { loadWorkspaceNavData } from "@/app/workspaces/[workspaceId]/layout-data";
import { prisma } from "@/lib/prisma";

import { WorkspaceSidebar } from "./WorkspaceSidebar";

// DESIGN.md calls for Inter (display) + JetBrains Mono (labels/body) across
// the app; scoped to this shell rather than the root layout since the rest
// of the app hasn't adopted the dark operational theme yet.
const inter = Inter({ variable: "--font-display", subsets: ["latin"] });
const jetBrainsMono = JetBrains_Mono({ variable: "--font-mono-label", subsets: ["latin"] });

// The sidebar/topbar shell shared by every screen inside the dark
// operational theme — both the per-Workspace subtree
// (app/workspaces/[workspaceId]/layout.tsx) and cross-Workspace pages that
// aren't nested under a /workspaces/[workspaceId] route (My Tasks, Updates)
// render through this rather than duplicating the sidebar-data-loading and
// font wiring a second time.
export async function AppShell({
  currentWorkspaceId,
  currentWorkspaceName,
  userId,
  children,
}: {
  currentWorkspaceId: string;
  currentWorkspaceName: string;
  userId: string;
  children: React.ReactNode;
}) {
  const navData = await loadWorkspaceNavData(prisma, userId, currentWorkspaceId);

  return (
    <div
      className={`${inter.variable} ${jetBrainsMono.variable} flex min-h-screen bg-canvas font-[family-name:var(--font-display)]`}
    >
      <WorkspaceSidebar
        currentWorkspaceId={currentWorkspaceId}
        currentWorkspaceName={currentWorkspaceName}
        switchableWorkspaces={navData.switchableWorkspaces}
        personalSpace={navData.personalSpace}
        unreadNotificationCount={navData.unreadNotificationCount}
        lists={navData.lists}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
