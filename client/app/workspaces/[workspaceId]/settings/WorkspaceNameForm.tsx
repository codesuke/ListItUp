"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspace/workspace-creation";

import { renameWorkspaceAction, type RenameWorkspaceState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const compactPrimaryButtonClass =
  "inline-flex h-9 items-center justify-center bg-[#ff6b4a] px-4 text-sm font-medium text-[#1a0d09] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff6b4a] focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted";

const initialRenameWorkspaceState: RenameWorkspaceState = { status: "idle" };

// Mirrors AutoSaveCustomField's Pencil-to-edit affordance for the Custom
// Field definition editor (ItemDetailPanel) — a read-only row with a
// Pencil toggle, swapping to an input plus explicit Cancel/Save rather
// than auto-submitting, since renaming a Workspace is a deliberate act,
// not a per-keystroke value.
export function WorkspaceNameForm({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const boundAction = renameWorkspaceAction.bind(null, workspaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialRenameWorkspaceState);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(workspaceName);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state.status === "success") {
      setDisplayName(state.name);
      setIsEditing(false);
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  if (!isEditing) {
    return (
      <div className="group">
        <span className={labelClass}>Workspace name</span>
        <div className="flex h-11 items-center justify-between gap-3 border border-surface-3 bg-surface-1/95 px-4 text-sm text-ink">
          <span className="truncate">{displayName}</span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="Edit Workspace name"
            className="shrink-0 text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="group">
      <label htmlFor="workspace-name" className={labelClass}>
        Workspace name
      </label>
      <div className={inputWrapperClass}>
        <input
          id="workspace-name"
          name="name"
          type="text"
          autoComplete="off"
          required
          maxLength={WORKSPACE_NAME_MAX_LENGTH}
          defaultValue={displayName}
          autoFocus
          className={inputClass}
        />
      </div>

      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-sm text-ink-faint transition-colors duration-150 hover:text-ink"
        >
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={compactPrimaryButtonClass}>
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
