"use client";

import { useRef, useState } from "react";

import type { ItemState } from "@/generated/prisma/client";

import { FieldSelect } from "./FieldSelect";
import { CHIP_CONTROL_CLASS, COMPACT_PRIMARY_BUTTON_CLASS, INPUT_CLASS } from "./panel-styles";

// ARCHIVED isn't offered here — archiving is a dedicated Archive/Restore
// action (on the Item detail panel) that preserves the prior state to
// return to, rather than a state a User picks from this list (#38).
const STATES: { value: Exclude<ItemState, "ARCHIVED">; label: string }[] = [
  { value: "TO_DO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETE", label: "Complete" },
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
    // immediately on change, once the hidden input's value has updated.
    if (state !== "BLOCKED") {
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  return (
    <form ref={formRef} action={boundTransition} className="flex flex-col gap-2">
      <input type="hidden" name="state" value={selected} />
      <FieldSelect
        value={selected}
        onChange={(event) => selectState(event.target.value as ItemState)}
        wrapperClassName="w-auto"
        controlClassName={CHIP_CONTROL_CLASS}
      >
        {STATES.map((state) => (
          <option key={state.value} value={state.value}>
            {state.label}
          </option>
        ))}
      </FieldSelect>

      {selected === "BLOCKED" && (
        <>
          <input
            type="text"
            name="blockerReason"
            defaultValue={currentBlockerReason ?? ""}
            placeholder="Blocker reason (required)"
            required
            className={`w-auto ${INPUT_CLASS}`}
          />
          <button type="submit" className={`self-start ${COMPACT_PRIMARY_BUTTON_CLASS}`}>
            Save
          </button>
        </>
      )}
    </form>
  );
}
