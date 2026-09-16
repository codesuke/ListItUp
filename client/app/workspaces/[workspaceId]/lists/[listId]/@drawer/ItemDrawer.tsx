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
      className="flex w-[380px] flex-shrink-0 flex-col overflow-y-auto border-l border-[#232323] bg-[#0d0d0d]"
      style={{ maxHeight: "100vh" }}
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[#232323] p-5">
        <span className="font-[family-name:var(--font-mono-label)] text-[10.5px] uppercase tracking-[0.08em] text-[#5a5a56]">
          {sectionLabel}
        </span>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] border border-[#333333] bg-[#141414] text-[#8f8f8a] hover:bg-[#1a1a1a] hover:text-[#e5e5e0]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </aside>
  );
}
