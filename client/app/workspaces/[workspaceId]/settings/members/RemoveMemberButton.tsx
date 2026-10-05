"use client";

import { useActionState } from "react";

import { removeMemberAction, type RemoveMemberState } from "./actions";

const removeButtonClass =
  "shrink-0 border border-destructive/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialRemoveMemberState: RemoveMemberState = { status: "idle" };

export function RemoveMemberButton({
  workspaceId,
  userId,
  name,
}: {
  workspaceId: string;
  userId: string;
  name: string;
}) {
  const boundAction = removeMemberAction.bind(null, workspaceId, userId);
  const [state, formAction, isPending] = useActionState(boundAction, initialRemoveMemberState);

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Remove ${name} from this Workspace`}
        className={removeButtonClass}
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
