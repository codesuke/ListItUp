"use client";

import { ChevronRight } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";

// The "Workspace >" prefix only makes sense once the sidebar's own
// workspace switcher is visible; once it collapses to icons, drop the
// prefix and keep just the current page label.
export function HomeBreadcrumb() {
  const { state } = useSidebar();
  const isSidebarCollapsed = state === "collapsed";

  return (
    <div className="flex items-center gap-2">
      {!isSidebarCollapsed && (
        <>
          <span className="font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            Workspace
          </span>
          <ChevronRight className="h-3 w-3 text-ink-faint" />
        </>
      )}
      <span className="text-[13px] font-semibold text-ink">Home</span>
    </div>
  );
}
