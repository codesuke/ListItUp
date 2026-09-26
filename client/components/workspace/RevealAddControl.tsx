"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { ADD_BUTTON_SECONDARY } from "@/components/workspace/add-button";

// An empty section (Dependencies, Attachments, Child Items) shows a plain
// "+ Add…" link instead of its add form open by default — clicking it
// swaps the link for the section's existing (unchanged) add controls. The
// "button" variant renders the same treatment as the other toolbar "add"
// actions (Section, per-section Add, New Task) for callers that sit
// alongside those controls instead of inline in a form list.
export function RevealAddControl({
  label,
  children,
  variant = "link",
}: {
  label: string;
  children: React.ReactNode;
  variant?: "link" | "button";
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return <>{children}</>;
  }

  if (variant === "button") {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ADD_BUTTON_SECONDARY}>
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
    );
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
