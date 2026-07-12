"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";

import { changePasswordAction, type ChangePasswordState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700";
const primaryButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808] disabled:cursor-not-allowed disabled:opacity-60";
const initialChangePasswordState: ChangePasswordState = { status: "idle" };

export function PasswordSettings() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialChangePasswordState
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="group">
        <label
          htmlFor="current-password"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
        >
          Current password
        </label>
        <div className={inputWrapperClass}>
          <LockKeyhole
            className="ml-4 h-5 w-5 text-neutral-600"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="group">
        <label
          htmlFor="new-password"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
        >
          New password
        </label>
        <div className={inputWrapperClass}>
          <LockKeyhole
            className="ml-4 h-5 w-5 text-neutral-600"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-[#ff8a70]">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-sm text-neutral-300">
          Your password was changed. Other sessions were signed out.
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Updating..." : "Change password"}
      </button>
    </form>
  );
}
