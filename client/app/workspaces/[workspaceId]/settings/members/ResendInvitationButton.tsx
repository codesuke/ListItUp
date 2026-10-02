"use client";

import { useActionState } from "react";

import { resendInvitationAction, type ResendInvitationState } from "./actions";

const buttonClass =
  "rounded-md border border-line-strong px-3 py-1 text-xs text-ink transition-colors duration-150 hover:border-[#ff6b4a] hover:text-ink disabled:cursor-not-allowed disabled:opacity-60";
const initialResendInvitationState: ResendInvitationState = { status: "idle" };

export function ResendInvitationButton({
  workspaceId,
  invitationId,
}: {
  workspaceId: string;
  invitationId: string;
}) {
  const boundAction = resendInvitationAction.bind(null, workspaceId, invitationId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialResendInvitationState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Resending..." : "Resend"}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
      {state.status === "success" ? (
        <span role="status" className="text-xs text-ink-faint">
          Resent
        </span>
      ) : null}
    </form>
  );
}
