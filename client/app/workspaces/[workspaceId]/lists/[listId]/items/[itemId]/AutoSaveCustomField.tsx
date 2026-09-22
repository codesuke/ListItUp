"use client";

import { FieldSelect } from "./FieldSelect";
import type { CustomFieldDefinitionSummary } from "./page-data";
import { FIELD_LABEL_CLASS, INPUT_CLASS } from "./panel-styles";
import { useAutoSaveField } from "./useAutoSaveField";

// Custom Field values commit on blur/change instead of a per-row Save
// button — each field submits independently via its own bound Server
// Action, so auto-saving one field never touches the others' values.
export function AutoSaveCustomField({
  definition,
  defaultValue,
  action,
}: {
  definition: CustomFieldDefinitionSummary;
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const { commit, isPending, justSaved } = useAutoSaveField("value", action);

  return (
    <div className="flex min-w-[15rem] flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL_CLASS}>{definition.name}</span>
        {(isPending || justSaved) && (
          <span className="text-[11px] text-ink-faint animate-in fade-in-0 duration-150">
            {isPending ? "Saving…" : "Saved"}
          </span>
        )}
      </div>
      {definition.type === "DROPDOWN" ? (
        <FieldSelect defaultValue={defaultValue} onChange={(event) => commit(event.target.value)} wrapperClassName="w-full">
          <option value="">—</option>
          {definition.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FieldSelect>
      ) : (
        <input
          type={definition.type === "DATE" ? "date" : definition.type === "NUMBER" ? "number" : "text"}
          defaultValue={defaultValue}
          onBlur={(event) => commit(event.target.value)}
          className={`w-full ${INPUT_CLASS}`}
        />
      )}
    </div>
  );
}
