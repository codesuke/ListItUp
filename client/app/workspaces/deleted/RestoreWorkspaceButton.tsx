"use client";

import { useActionState } from "react";

import { restoreWorkspaceAction, type RestoreWorkspaceState } from "./actions";

const buttonClass =
  "inline-flex h-9 shrink-0 items-center justify-center border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-[#ff6b4a] hover:text-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff6b4a] focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialState: RestoreWorkspaceState = { status: "idle" };

export function RestoreWorkspaceButton({ workspaceId }: { workspaceId: string }) {
  const boundAction = restoreWorkspaceAction.bind(null, workspaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  if (state.status === "success") {
    return <p className="shrink-0 text-sm text-ink-muted">Restored</p>;
  }

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-1">
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Restoring..." : "Restore"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
