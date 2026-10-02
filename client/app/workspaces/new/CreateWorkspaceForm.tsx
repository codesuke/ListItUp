"use client";

import { useActionState } from "react";

import { WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspace/workspace-creation";

import { createWorkspaceAction, type CreateWorkspaceState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const primaryButtonClass =
  "mt-2 inline-flex h-11 min-h-11 items-center justify-center bg-[#ff6b4a] px-6 text-sm font-medium text-[#1a0d09] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff6b4a] focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialState: CreateWorkspaceState = { status: "idle" };

export function CreateWorkspaceForm() {
  const [state, formAction, isPending] = useActionState(createWorkspaceAction, initialState);

  return (
    <form action={formAction} className="grid gap-5">
      <div className="group">
        <label
          htmlFor="workspace-name"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
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
            placeholder="Launch Team"
            className={inputClass}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Creating..." : "Create Workspace"}
      </button>
    </form>
  );
}
