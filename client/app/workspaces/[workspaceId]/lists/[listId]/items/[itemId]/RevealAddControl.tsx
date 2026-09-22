"use client";

import { useState } from "react";

// An empty section (Dependencies, Attachments, Child Items) shows a plain
// "+ Add…" link instead of its add form open by default — clicking it
// swaps the link for the section's existing (unchanged) add controls.
export function RevealAddControl({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return <>{children}</>;
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="self-start text-[12.5px] font-medium text-[#ff8a70] transition-colors duration-150 hover:text-[#ff6b4a] hover:underline"
    >
      {label}
    </button>
  );
}
