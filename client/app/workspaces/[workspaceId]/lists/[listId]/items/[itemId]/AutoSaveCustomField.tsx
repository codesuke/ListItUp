"use client";

import { Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { FieldSelect } from "./FieldSelect";
import type { CustomFieldDefinitionSummary } from "./page-data";
import { COMPACT_PRIMARY_BUTTON_CLASS, CUSTOM_FIELD_CONTROL_CLASS, FIELD_LABEL_CLASS } from "./panel-styles";

// Matches the settings page's own save-confirmation timing
// (NotificationPreferencesForm's SAVED_INDICATOR_DURATION_MS) so "Saved"
// reads consistently across the app.
const SAVED_INDICATOR_DURATION_MS = 1800;

// Custom Field values commit on blur/change instead of a per-row Save
// button — each field submits independently via its own bound Server
// Action, so auto-saving one field never touches the others' values.
export function AutoSaveCustomField({
  definition,
  defaultValue,
  action,
  canDefineCustomFields,
  editAction,
}: {
  definition: CustomFieldDefinitionSummary;
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
  // Renaming/editing the definition itself (vs. just setting its value on
  // this Item) is Lead/Admin-only — the same threshold as defining a new
  // field (#34, #60) — so this affordance is separately gated from the
  // value control above, which any List Member with canEdit reaches.
  canDefineCustomFields: boolean;
  editAction: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [isSavingDefinition, startDefinitionTransition] = useTransition();

  function commit(value: string) {
    const formData = new FormData();
    formData.set("value", value);
    startTransition(async () => {
      await action(formData);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), SAVED_INDICATOR_DURATION_MS);
    });
  }

  function saveDefinition(formData: FormData) {
    startDefinitionTransition(async () => {
      await editAction(formData);
      setIsEditingDefinition(false);
    });
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL_CLASS}>{definition.name}</span>
        {canDefineCustomFields && !isEditingDefinition && (
          <button
            type="button"
            onClick={() => setIsEditingDefinition(true)}
            aria-label={`Edit ${definition.name} field`}
            className="text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {(isPending || justSaved) && (
          <span className="text-[11px] text-ink-faint animate-in fade-in-0 duration-150">
            {isPending ? "Saving…" : "Saved"}
          </span>
        )}
      </div>
      {isEditingDefinition ? (
        <form action={saveDefinition} className="flex flex-col gap-1.5">
          <input
            type="text"
            name="name"
            defaultValue={definition.name}
            required
            className={`w-full ${CUSTOM_FIELD_CONTROL_CLASS}`}
          />
          {definition.type === "DROPDOWN" && (
            <input
              type="text"
              name="options"
              defaultValue={definition.options.join(", ")}
              placeholder="Options, comma-separated"
              className={`w-full ${CUSTOM_FIELD_CONTROL_CLASS}`}
            />
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditingDefinition(false)}
              className="text-[11.5px] text-ink-faint transition-colors duration-150 hover:text-ink"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSavingDefinition} className={COMPACT_PRIMARY_BUTTON_CLASS}>
              {isSavingDefinition ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : definition.type === "DROPDOWN" ? (
        <FieldSelect
          defaultValue={defaultValue}
          onChange={(event) => commit(event.target.value)}
          wrapperClassName="w-full"
          controlClassName={CUSTOM_FIELD_CONTROL_CLASS}
        >
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
          className={`w-full ${CUSTOM_FIELD_CONTROL_CLASS}`}
        />
      )}
    </div>
  );
}
