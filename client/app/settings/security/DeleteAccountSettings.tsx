"use client";

import { useActionState, useState } from "react";
import { Mail, TriangleAlert } from "lucide-react";

import { deleteAccountAction, type DeleteAccountState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-destructive";
const inputClass =
  "h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const dangerButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-destructive bg-destructive px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialDeleteAccountState: DeleteAccountState = { status: "idle" };

function soleLeadBlockMessage(count: number): string {
  const listWord = count === 1 ? "List" : "Lists";
  return `You're the only Lead of ${count} ${listWord}. Promote another Lead on each before deleting your account.`;
}

export function DeleteAccountSettings({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteAccountAction,
    initialDeleteAccountState
  );
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const isConfirmed = confirmationEmail.trim().toLowerCase() === currentEmail.toLowerCase();

  return (
    <form action={formAction} className="grid gap-5">
      <p className="text-sm text-ink-muted">
        Deleting your account is permanent. Type{" "}
        <span className="font-mono text-ink">{currentEmail}</span> to confirm.
      </p>

      <div className="group">
        <label
          htmlFor="delete-account-confirmation-email"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          Confirm your email
        </label>
        <div className={inputWrapperClass}>
          <Mail
            className="ml-4 h-5 w-5 text-ink-faint"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="delete-account-confirmation-email"
            name="confirmationEmail"
            type="email"
            autoComplete="off"
            required
            value={confirmationEmail}
            onChange={(event) => setConfirmationEmail(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}
      {state.status === "sole-lead-block" ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{soleLeadBlockMessage(state.count)}</span>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!isConfirmed || isPending}
        className={dangerButtonClass}
      >
        {isPending ? "Deleting..." : "Delete account"}
      </button>
    </form>
  );
}
