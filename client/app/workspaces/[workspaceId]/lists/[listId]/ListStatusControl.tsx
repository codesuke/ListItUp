"use client";

import { useRef, useState } from "react";

import type { ListStatus } from "@/generated/prisma/client";

const STATUS_LABEL: Record<ListStatus, string> = {
  ON_TRACK: "On Track",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
};

// List Lead/Workspace Admin (>=LEAD, same threshold as Description/Roles —
// see ListPageData.canEditDescription) gets an editable dropdown that
// submits on change; everyone else sees plain read-only text (#59). Status
// is communicated as plain text here, never a colored-background pill, per
// DESIGN.md's No-Pill-Status Rule.
export function ListStatusControl({
  status,
  canEdit,
  boundSetStatus,
}: {
  status: ListStatus;
  canEdit: boolean;
  boundSetStatus: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<ListStatus>(status);
  const formRef = useRef<HTMLFormElement>(null);

  if (!canEdit) {
    return <span className="text-[12.5px] text-ink-muted">{STATUS_LABEL[status]}</span>;
  }

  function selectStatus(next: ListStatus) {
    setSelected(next);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={boundSetStatus}>
      <select
        name="status"
        value={selected}
        onChange={(event) => selectStatus(event.target.value as ListStatus)}
        aria-label="List status"
        className="cursor-pointer rounded-[5px] border-0 bg-transparent px-0 py-0 text-[12.5px] text-ink-muted transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a]"
      >
        {(Object.entries(STATUS_LABEL) as [ListStatus, string][]).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
