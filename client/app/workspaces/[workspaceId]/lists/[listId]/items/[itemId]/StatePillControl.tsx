"use client";

import { useRef, useState } from "react";

import type { ItemState } from "@/generated/prisma/client";

import { PROPERTY_CHIP_CONTROL_CLASS } from "./panel-styles";

// ARCHIVED isn't offered here — archiving is a dedicated Archive/Restore
// action (on the Item detail panel) that preserves the prior state to
// return to, rather than a state a User picks from this list (#38).
const STATES: { value: Exclude<ItemState, "ARCHIVED">; label: string; color: string }[] = [
  { value: "TO_DO", label: "To Do", color: "#8f8f8a" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#5b9dff" },
  { value: "BLOCKED", label: "Blocked", color: "#f5b642" },
  { value: "COMPLETE", label: "Complete", color: "#3ecf8e" },
];

// Shared with the read-only status chip so both the editable picker and
// the plain display use the exact same color per state.
export const STATE_COLOR: Record<ItemState, string> = {
  TO_DO: "#8f8f8a",
  IN_PROGRESS: "#5b9dff",
  BLOCKED: "#f5b642",
  COMPLETE: "#3ecf8e",
  ARCHIVED: "#5a5a56",
};

export function StatePillControl({
  currentState,
  currentBlockerReason,
  boundTransition,
}: {
  currentState: ItemState;
  currentBlockerReason: string | null;
  boundTransition: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<ItemState>(currentState);
  const formRef = useRef<HTMLFormElement>(null);
  const activeColor = STATES.find((state) => state.value === selected)?.color ?? "#8f8f8a";

  function selectState(state: ItemState) {
    setSelected(state);
    // Blocked needs a reason typed first — every other state can submit
    // immediately on change, once the hidden input's value has updated.
    if (state !== "BLOCKED") {
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  return (
    <form ref={formRef} action={boundTransition} className="flex flex-col gap-2">
      <input type="hidden" name="state" value={selected} />
      <div className="relative inline-flex items-center">
        <span className="pointer-events-none absolute left-[11px] h-[6px] w-[6px] rounded-full" style={{ backgroundColor: activeColor }} />
        <select
          value={selected}
          onChange={(event) => selectState(event.target.value as ItemState)}
          className={`w-auto pl-6 text-ink-muted ${PROPERTY_CHIP_CONTROL_CLASS}`}
        >
          {STATES.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
      </div>

      {selected === "BLOCKED" && (
        <>
          <input
            type="text"
            name="blockerReason"
            defaultValue={currentBlockerReason ?? ""}
            placeholder="Blocker reason (required)"
            required
            className="rounded-[6px] border border-line-strong bg-surface-3 px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none"
          />
          <button
            type="submit"
            className="self-start rounded-[6px] bg-[#ff6b4a] px-3 py-1.5 text-[12.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]"
          >
            Save
          </button>
        </>
      )}
    </form>
  );
}
