"use client";

import { useActionState } from "react";
import { KeyRound, LockKeyhole, Mail } from "lucide-react";

import {
  requestEmailChangeAction,
  type RequestEmailChangeState,
} from "./actions";

const inputWrapperClass =
  "flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700";
const primaryButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808] disabled:cursor-not-allowed disabled:opacity-60";
const initialRequestEmailChangeState: RequestEmailChangeState = {
  status: "idle",
};

export function EmailSettings({
  currentEmail,
  twoFactorEnabled,
}: {
  currentEmail: string;
  twoFactorEnabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    requestEmailChangeAction,
    initialRequestEmailChangeState
  );

  return (
    <form action={formAction} className="grid gap-5">
      <p className="text-sm text-neutral-400">
        Current email: <span className="text-white">{currentEmail}</span>
      </p>

      <div className="group">
        <label
          htmlFor="new-email"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
        >
          New email
        </label>
        <div className={inputWrapperClass}>
          <Mail
            className="ml-4 h-5 w-5 text-neutral-600"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="new-email"
            name="newEmail"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="group">
        <label
          htmlFor="email-change-password"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
        >
          Password
        </label>
        <div className={inputWrapperClass}>
          <LockKeyhole
            className="ml-4 h-5 w-5 text-neutral-600"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="email-change-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
      </div>

      {twoFactorEnabled ? (
        <div className="group">
          <label
            htmlFor="email-change-2fa"
            className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
          >
            Two-factor code
          </label>
          <div className={inputWrapperClass}>
            <KeyRound
              className="ml-4 h-5 w-5 text-neutral-600"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <input
              id="email-change-2fa"
              name="twoFactorCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className={inputClass}
            />
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-[#ff8a70]">
          {state.message}
        </p>
      ) : null}
      {state.status === "sent" ? (
        <p role="status" className="text-sm text-neutral-300">
          Check your new inbox for a confirmation link. Your email stays the
          same until you confirm it.
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Sending..." : "Change email"}
      </button>
    </form>
  );
}
