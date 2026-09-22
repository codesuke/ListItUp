"use client";

import { useAutoSaveField } from "./useAutoSaveField";

// Same exact input styling as before — only the save mechanism changed
// (blur instead of a visible Save button), consistent with how Custom
// Fields and every other single-value control on this panel already save.
const TITLE_INPUT_CLASS =
  "-mx-2 w-[calc(100%+1rem)] rounded-[6px] bg-transparent px-2 py-1 text-[22px] font-semibold leading-snug tracking-tight text-ink transition-colors duration-150 hover:bg-surface-3 focus:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a]/50";

export function AutoSaveTitleInput({
  defaultValue,
  action,
}: {
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const { commit, isPending, justSaved } = useAutoSaveField("title", action);

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        defaultValue={defaultValue}
        onBlur={(event) => {
          const value = event.target.value.trim();
          if (value) commit(value);
        }}
        className={TITLE_INPUT_CLASS}
      />
      {(isPending || justSaved) && (
        <span className="px-2 text-[11px] text-ink-faint animate-in fade-in-0 duration-150">
          {isPending ? "Saving…" : "Saved"}
        </span>
      )}
    </div>
  );
}
