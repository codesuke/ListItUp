"use client";

import { useState } from "react";

const TAB_LABEL = { comments: "Comments", private: "Private note" } as const;
type ActivityTab = keyof typeof TAB_LABEL;

// Comments (the Notes feed) and the Private note share one Activity
// section as two tabs rather than two stacked blocks. Plain underline
// tabs — text-only, accent-red + bottom-border on the active tab — so
// this reads as navigation between two views, not two competing buttons.
export function ActivityTabs({
  comments,
  privateNote,
}: {
  comments: React.ReactNode;
  privateNote: React.ReactNode | null;
}) {
  const [tab, setTab] = useState<ActivityTab>("comments");

  // Only List Members who are Assignees ever get a Private note (#37) — if
  // there's nothing to switch to, don't show tab chrome for one tab.
  if (!privateNote) {
    return <>{comments}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 border-b border-line-strong/60">
        {(Object.keys(TAB_LABEL) as ActivityTab[]).map((key) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative pb-2 text-[12.5px] font-medium transition-colors duration-150 ${
                isActive ? "text-[#ff6b4a]" : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              {TAB_LABEL[key]}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#ff6b4a]" />}
            </button>
          );
        })}
      </div>
      {tab === "comments" ? comments : privateNote}
    </div>
  );
}
