"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";

import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/auth-config";
import {
  resendVerificationAction,
  signOutAction,
  type ResendFormState,
} from "./actions";

const initialResendState: ResendFormState = { status: "idle" };

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const returnTo = searchParams.get("returnTo") ?? "";
  const [state, formAction, isPending] = useActionState(
    resendVerificationAction,
    initialResendState
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [lastHandledState, setLastHandledState] = useState(state);

  // Reset the cooldown as soon as a new "sent" result renders. Adjusting
  // state during render (rather than in an effect) avoids an extra
  // cascading render — see https://react.dev/learn/you-might-not-need-an-effect.
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.status === "sent") {
      setCooldownSeconds(VERIFICATION_RESEND_COOLDOWN_SECONDS);
    }
  }

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const resendDisabled = isPending || cooldownSeconds > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-neutral-300">
      <div className="w-full max-w-md border border-[#1a1a1a] bg-[#0b0b0b]/80 p-8">
        <div className="mb-6 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Verify email"}
          </span>
        </div>

        <div className="mb-6 flex h-12 w-12 items-center justify-center border border-[#1a1a1a] bg-[#0d0d0d]">
          <Mail
            className="h-5 w-5 text-[#ff6b4a]"
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </div>

        <h1 className="text-2xl font-light text-white">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          {email
            ? `We sent a verification link to ${email}. Click it to finish setting up your account.`
            : "We sent a verification link to your email. Click it to finish setting up your account."}
        </p>

        <form action={formAction} className="mt-8">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            disabled={resendDisabled}
            className="inline-flex h-12 w-full items-center justify-center border border-[#1a1a1a] bg-[#0d0d0d]/95 text-sm text-neutral-300 transition-colors hover:border-[#333333] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cooldownSeconds > 0
              ? `Resend available in ${cooldownSeconds}s`
              : isPending
                ? "Sending..."
                : "Resend verification email"}
          </button>
        </form>

        {state.status === "sent" ? (
          <p className="mt-3 text-xs text-neutral-500" role="status">
            If that address needs a new link, we just sent one.
          </p>
        ) : null}

        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="text-sm text-neutral-500 underline decoration-[#333333] underline-offset-4 transition-colors hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
