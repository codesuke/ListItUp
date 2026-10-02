"use client";

import { useRef, useState } from "react";

import type { ListStatus } from "@/generated/prisma/client";
import { StatusBadge, TONE_CLASSES, type StatusBadgeTone } from "@/components/workspace/StatusBadge";

const STATUS_PRESENTATION: Record<ListStatus, { label: string; tone: StatusBadgeTone }> = {
  ON_TRACK: { label: "On Track", tone: "green" },
  ON_HOLD: { label: "On Hold", tone: "amber" },
  COMPLETED: { label: "Completed", tone: "blue" },
  DROPPED: { label: "Dropped", tone: "red" },
};

// List Lead/Workspace Admin (>=LEAD, same threshold as Description/Roles —
// see ListPageData.canEditDescription) gets an editable dropdown that
// submits on change; everyone else sees the plain read-only badge (#59).
export function ListStatusPill({
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
    const { label, tone } = STATUS_PRESENTATION[status];
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
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
        className={`cursor-pointer whitespace-nowrap rounded-[5px] border-0 px-[7px] py-[2px] font-[family-name:var(--font-mono-label)] text-[10px] font-semibold tracking-[0.05em] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a] ${TONE_CLASSES[STATUS_PRESENTATION[selected].tone]}`}
      >
        {(Object.entries(STATUS_PRESENTATION) as [ListStatus, { label: string; tone: StatusBadgeTone }][]).map(
          ([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          )
        )}
      </select>
    </form>
  );
}
