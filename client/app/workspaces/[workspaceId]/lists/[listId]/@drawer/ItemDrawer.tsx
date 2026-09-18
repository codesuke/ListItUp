"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Closing via router.back() (rather than a Link to the List page) is the
// pattern Next.js's own intercepted-route modal docs recommend — it
// correctly unwinds to whatever the User was looking at before opening the
// drawer (including a specific tab/filter), and reopens the drawer on
// forward navigation.
export function ItemDrawer({ sectionLabel, children }: { sectionLabel: string; children: React.ReactNode }) {
  const router = useRouter();

  return (
    <aside
      className="flex w-[380px] flex-shrink-0 flex-col overflow-y-auto border-l border-line bg-surface-1 animate-in slide-in-from-right fade-in-0 duration-200"
      style={{ maxHeight: "100vh" }}
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line p-5">
        <span className="font-[family-name:var(--font-mono-label)] text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
          {sectionLabel}
        </span>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </aside>
  );
}
