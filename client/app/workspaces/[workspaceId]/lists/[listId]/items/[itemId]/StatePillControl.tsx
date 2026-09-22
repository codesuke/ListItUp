"use client";

import { useRef, useState } from "react";

import type { ItemState } from "@/generated/prisma/client";

// ARCHIVED isn't offered here — archiving is a dedicated Archive/Restore
// action (on the Item detail panel) that preserves the prior state to
// return to, rather than a state a User picks from this list (#38).
const STATES: { value: Exclude<ItemState, "ARCHIVED">; label: string; color: string }[] = [
  { value: "TO_DO", label: "To Do", color: "#8f8f8a" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#5b9dff" },
  { value: "BLOCKED", label: "Blocked", color: "#f5b642" },
  { value: "COMPLETE", label: "Complete", color: "#3ecf8e" },
];

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

  function selectState(state: ItemState) {
    setSelected(state);
    // Blocked needs a reason typed first — every other state can submit
    // immediately on click, once the hidden input's value has updated.
    if (state !== "BLOCKED") {
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  return (
    <form ref={formRef} action={boundTransition} className="flex flex-col gap-2">
      <input type="hidden" name="state" value={selected} />
      <div className="flex flex-wrap gap-1.5">
        {STATES.map((state) => {
          const isActive = selected === state.value;
          return (
            <button
              key={state.value}
              type="button"
              onClick={() => selectState(state.value)}
              className="rounded-full border px-2.5 py-[5px] text-[11.5px] font-semibold transition-colors duration-150"
              style={
                isActive
                  ? { borderColor: state.color, color: state.color, backgroundColor: `${state.color}24` }
                  : { borderColor: "#333333", color: "#8f8f8a" }
              }
            >
              {state.label}
            </button>
          );
        })}
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
