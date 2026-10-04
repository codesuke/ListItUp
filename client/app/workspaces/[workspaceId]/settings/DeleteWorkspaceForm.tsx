"use client";

import { useActionState } from "react";

import { deleteWorkspaceAction, type DeleteWorkspaceState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const dangerButtonClass =
  "mt-2 inline-flex h-11 min-h-11 items-center justify-center border border-destructive bg-destructive/10 px-6 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialDeleteWorkspaceState: DeleteWorkspaceState = { status: "idle" };

export function DeleteWorkspaceForm({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const boundAction = deleteWorkspaceAction.bind(null, workspaceId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialDeleteWorkspaceState
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="group">
        <label
          htmlFor="confirm-delete-workspace-name"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          Type &ldquo;{workspaceName}&rdquo; to confirm
        </label>
        <div className={inputWrapperClass}>
          <input
            id="confirm-delete-workspace-name"
            name="confirmedWorkspaceName"
            type="text"
            autoComplete="off"
            required
            className={inputClass}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={dangerButtonClass}>
        {isPending ? "Deleting..." : "Delete Workspace"}
      </button>
    </form>
  );
}
