"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { ADD_BUTTON_PRIMARY } from "@/components/workspace/add-button";

type SaveResult = { status: "idle" } | { status: "saved" } | { status: "error" };

const INITIAL_SAVE_RESULT: SaveResult = { status: "idle" };

// Save stays disabled whenever the textarea matches what was last persisted
// (nothing dirty) or a save is in flight — it only re-enables once the user
// changes the text again (#60-style "greyed out until edited" affordance).
export function DescriptionForm({
  description,
  boundUpdateDescription,
}: {
  description: string | null;
  boundUpdateDescription: (formData: FormData) => Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);
  // Tracks the textarea's live value so a save that resolves after the user
  // has already typed a further edit doesn't clear `dirty` out from under
  // that newer, unsaved edit.
  const liveValueRef = useRef(description ?? "");
  const [saveResult, formAction, isPending] = useActionState<SaveResult, FormData>(
    async (_previous, formData) => {
      const submittedValue = String(formData.get("description") ?? "");

      try {
        await boundUpdateDescription(formData);
      } catch {
        return { status: "error" };
      }

      if (liveValueRef.current === submittedValue) {
        setDirty(false);
      }
      return { status: "saved" };
    },
    INITIAL_SAVE_RESULT
  );

  const isSaveDisabled = !dirty || isPending;
  const showSavedConfirmation = saveResult.status === "saved" && !dirty;
  const showSaveError = saveResult.status === "error" && !isPending;

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <textarea
        name="description"
        defaultValue={description ?? ""}
        placeholder="What is this List for?"
        rows={3}
        onChange={(event) => {
          liveValueRef.current = event.target.value;
          setDirty(true);
        }}
        className="w-full rounded-[8px] border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a]"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSaveDisabled}
          className={`self-start ${ADD_BUTTON_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#ff6b4a]`}
        >
          Save
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        </button>
        {showSavedConfirmation && (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1 text-[12.5px] text-ink-muted animate-in fade-in-0 duration-150"
          >
            <Check className="h-3.5 w-3.5 text-[#4ade80]" aria-hidden="true" /> Saved
          </span>
        )}
        {showSaveError && (
          <span
            role="alert"
            className="flex items-center gap-1 text-[12.5px] text-[#ff8a70] animate-in fade-in-0 duration-150"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Couldn&apos;t save — try again.
          </span>
        )}
      </div>
    </form>
  );
}
