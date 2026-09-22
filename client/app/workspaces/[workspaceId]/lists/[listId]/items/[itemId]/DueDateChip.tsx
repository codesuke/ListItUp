"use client";

import { Calendar } from "lucide-react";

import { PROPERTY_CHIP_CONTROL_CLASS } from "./panel-styles";
import { useAutoSaveField } from "./useAutoSaveField";

// A leading calendar icon overlaid the same way FieldSelect overlays its
// chevron — the native date <input> can't render a leading icon itself, so
// this repaints one on top with left padding to make room.
export function DueDateChip({
  defaultValue,
  action,
}: {
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const { commit } = useAutoSaveField("dueDate", action);

  return (
    <div className="relative inline-flex items-center">
      <Calendar className="pointer-events-none absolute left-2.5 h-3 w-3 text-ink-faint" />
      <input
        type="date"
        defaultValue={defaultValue}
        onChange={(event) => commit(event.target.value)}
        className={`w-auto pl-7 text-ink-muted ${PROPERTY_CHIP_CONTROL_CLASS}`}
      />
    </div>
  );
}
