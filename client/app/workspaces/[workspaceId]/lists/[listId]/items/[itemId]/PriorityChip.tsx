"use client";

import { useState } from "react";

import type { ItemPriority } from "@/generated/prisma/client";

import { PROPERTY_CHIP_CONTROL_CLASS } from "./panel-styles";
import { useAutoSaveField } from "./useAutoSaveField";

const PRIORITY_LABEL: Record<ItemPriority, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High" };
// Same red as StatusBadge's "red" tone, applied directly to the select's
// own text instead of through StatusBadge (that component always pairs a
// tinted background with its tone; this chip only needs the text color).
const HIGH_PRIORITY_CLASS = "text-[#f2545b]";
const DEFAULT_PRIORITY_CLASS = "text-ink-muted";

// Text-only chip — colored red when High, otherwise the same muted tone as
// every other properties-strip chip. Local state so the color updates the
// instant the User picks a new value, without waiting on the Server Action
// round trip.
export function PriorityChip({
  defaultValue,
  action,
}: {
  defaultValue: ItemPriority;
  action: (formData: FormData) => Promise<void>;
}) {
  const [priority, setPriority] = useState(defaultValue);
  const { commit } = useAutoSaveField("priority", action);

  return (
    <select
      defaultValue={defaultValue}
      onChange={(event) => {
        const value = event.target.value as ItemPriority;
        setPriority(value);
        commit(value);
      }}
      className={`${PROPERTY_CHIP_CONTROL_CLASS} ${priority === "HIGH" ? HIGH_PRIORITY_CLASS : DEFAULT_PRIORITY_CLASS}`}
    >
      {(Object.keys(PRIORITY_LABEL) as ItemPriority[]).map((value) => (
        <option key={value} value={value}>
          {PRIORITY_LABEL[value]}
        </option>
      ))}
    </select>
  );
}
