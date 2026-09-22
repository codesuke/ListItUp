"use client";

import { useState } from "react";

// An empty section (Dependencies, Attachments, Child Items), and the
// always-open add controls for Labels/Assignees/Custom Fields, show a
// small trigger instead of their add form open by default — clicking it
// swaps the trigger for the section's existing (unchanged) add controls.
export function RevealAddControl({
  label,
  renderTrigger,
  collapsible = false,
  children,
}: {
  label?: string;
  // Overrides the default text-link trigger — used for the dashed-chip
  // "+ Label" / "+ Assignee" triggers in the properties strip.
  renderTrigger?: (open: () => void) => React.ReactNode;
  // Custom Fields' add form can be closed again after opening; the
  // empty-state add links (Dependencies/Attachments/Child Items) don't
  // need this since they only ever appear once, on an empty section.
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    if (!collapsible) {
      return <>{children}</>;
    }
    return (
      <div className="flex flex-col items-start gap-1.5">
        {children}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (renderTrigger) {
    return <>{renderTrigger(() => setOpen(true))}</>;
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
