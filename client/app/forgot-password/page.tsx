"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import {
  requestPasswordResetAction,
  type ForgotPasswordFormState,
} from "./actions";

const initialForgotPasswordState: ForgotPasswordFormState = { status: "idle" };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialForgotPasswordState
  );

  return (
    <AuthPageShell
      kicker="// Reset password"
      heroTitle="Forgot your password?"
      heroCopy="We'll email you a link to choose a new one."
    >
      <form action={formAction} className="grid gap-5">
        <div className="group">
          <label
            htmlFor="email"
            className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
          >
            Email
          </label>
          <div className="flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]">
            <Mail
              className="ml-4 h-5 w-5 text-neutral-600"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              className="h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-4 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{isPending ? "Sending..." : "Send reset link"}</span>
          <ArrowUpRight
            className="h-5 w-5"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        {state.status === "sent" ? (
          <p role="status" className="text-sm text-neutral-500">
            If that email has an account, a reset link is on its way.
          </p>
        ) : null}
      </form>

      <p className="mt-8 text-sm text-neutral-500">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="text-white underline decoration-[#333333] underline-offset-4 hover:decoration-[#ff6b4a]"
        >
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
