"use client";

import { useActionState } from "react";

import { leaveWorkspaceAction, type LeaveWorkspaceState } from "./actions";

const leaveButtonClass =
  "inline-flex h-11 min-h-11 items-center justify-center border border-destructive bg-destructive/10 px-6 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialLeaveWorkspaceState: LeaveWorkspaceState = { status: "idle" };

export function LeaveWorkspaceButton({ workspaceId }: { workspaceId: string }) {
  const boundAction = leaveWorkspaceAction.bind(null, workspaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialLeaveWorkspaceState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <button type="submit" disabled={isPending} className={leaveButtonClass}>
        {isPending ? "Leaving..." : "Leave Workspace"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
