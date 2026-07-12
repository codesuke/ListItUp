"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Eye, EyeClosed, LockKeyhole } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/auth-config";
import { resetPasswordAction, type ResetPasswordFormState } from "./actions";

const initialState: ResetPasswordFormState = { status: "idle" };

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    initialState
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthPageShell
      kicker="// Reset password"
      heroTitle="Choose a new password."
      heroCopy="Use at least 12 characters. Any passphrase you'll remember works."
    >
      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="token" value={token} />

        <div className="group">
          <label
            htmlFor="password"
            className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
          >
            New password
          </label>
          <div className="flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]">
            <LockKeyhole
              className="ml-4 h-5 w-5 text-neutral-600"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="At least 12 characters"
              required
              className="h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700"
            />
            <button
              type="button"
              className="relative grid h-[58px] w-[58px] place-items-center overflow-hidden text-neutral-600 transition-colors hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <EyeClosed
                  className="h-5 w-5"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
              ) : (
                <Eye className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {state.status === "error" ? (
          <p role="alert" className="text-sm text-[#ff8a70]">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="mt-4 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{isPending ? "Updating..." : "Update password"}</span>
          <ArrowUpRight
            className="h-5 w-5"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>
      </form>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
