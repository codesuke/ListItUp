"use client";

import { useState } from "react";

const TAB_LABEL = { comments: "Comments", private: "Private note" } as const;
type ActivityTab = keyof typeof TAB_LABEL;

// Comments (the Notes feed) and the Private note share one Activity
// section as two tabs rather than two stacked blocks. Same segmented-pill
// language as StatePillControl (rounded-full, brand-orange active state)
// so this reads as the same design system, not a new control.
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
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TAB_LABEL) as ActivityTab[]).map((key) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="rounded-full border px-2.5 py-[5px] text-[11.5px] font-semibold transition-colors duration-150"
              style={
                isActive
                  ? { borderColor: "#ff6b4a", color: "#ff6b4a", backgroundColor: "#ff6b4a24" }
                  : { borderColor: "#333333", color: "#8f8f8a" }
              }
            >
              {TAB_LABEL[key]}
            </button>
          );
        })}
      </div>
      {tab === "comments" ? comments : privateNote}
    </div>
  );
}
