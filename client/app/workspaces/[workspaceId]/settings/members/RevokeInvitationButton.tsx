"use client";

import { useActionState } from "react";

import { revokeInvitationAction, type RevokeInvitationState } from "./actions";

const revokeButtonClass =
  "shrink-0 border border-destructive/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialRevokeInvitationState: RevokeInvitationState = { status: "idle" };

export function RevokeInvitationButton({
  workspaceId,
  invitationId,
  email,
}: {
  workspaceId: string;
  invitationId: string;
  email: string;
}) {
  const boundAction = revokeInvitationAction.bind(null, workspaceId, invitationId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialRevokeInvitationState
  );

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Revoke invitation to ${email}`}
        className={revokeButtonClass}
      >
        {isPending ? "Revoking..." : "Revoke"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
