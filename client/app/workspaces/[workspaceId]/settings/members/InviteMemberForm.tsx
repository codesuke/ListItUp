"use client";

import { useActionState } from "react";

import { createInvitationAction, type CreateInvitationState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const primaryButtonClass =
  "mt-2 inline-flex h-11 min-h-11 items-center justify-center border border-[#ff6b4a] bg-[#ff6b4a]/10 px-6 text-sm font-medium text-[#ff6b4a] transition-colors hover:bg-[#ff6b4a]/20 focus:outline-none focus:ring-2 focus:ring-[#ff6b4a] focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialCreateInvitationState: CreateInvitationState = { status: "idle" };

export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const boundAction = createInvitationAction.bind(null, workspaceId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialCreateInvitationState
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="group">
        <label
          htmlFor="invite-email"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          Email
        </label>
        <div className={inputWrapperClass}>
          <input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="group">
        <label
          htmlFor="invite-role"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          Role
        </label>
        <div className={inputWrapperClass}>
          <select
            id="invite-role"
            name="role"
            defaultValue="MEMBER"
            className="h-11 w-full bg-transparent px-4 text-sm text-ink outline-none"
          >
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-sm text-ink animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.resent
            ? `${state.email} already had a Pending Invitation — resent with a fresh link.`
            : `Invitation sent to ${state.email}.`}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Sending..." : "Send invitation"}
      </button>
    </form>
  );
}
