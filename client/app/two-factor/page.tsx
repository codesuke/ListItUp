"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import {
  verifyTwoFactorChallengeAction,
  type TwoFactorChallengeFormState,
} from "./actions";

const initialState: TwoFactorChallengeFormState = { status: "idle" };

function TwoFactorChallengeContent() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") ?? "";
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [state, formAction, isPending] = useActionState(
    verifyTwoFactorChallengeAction,
    initialState
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-neutral-300">
      <div className="w-full max-w-md border border-[#1a1a1a] bg-[#0b0b0b]/80 p-8">
        <div className="mb-6 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Two-factor"}
          </span>
        </div>

        <div className="mb-6 flex h-12 w-12 items-center justify-center border border-[#1a1a1a] bg-[#0d0d0d]">
          <ShieldCheck
            className="h-5 w-5 text-[#ff6b4a]"
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </div>

        <h1 className="text-2xl font-light text-white">
          Enter your two-factor code
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          {useRecoveryCode
            ? "Enter one of your unused recovery codes."
            : "Open your authenticator app and enter the current code."}
        </p>

        <form action={formAction} className="mt-8 grid gap-5">
          <input type="hidden" name="callbackURL" value={callbackURL} />
          <input
            type="hidden"
            name="mode"
            value={useRecoveryCode ? "recovery" : "totp"}
          />

          <div className="group">
            <label
              htmlFor="code"
              className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
            >
              {useRecoveryCode ? "Recovery code" : "Authenticator code"}
            </label>
            <div className="flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]">
              <KeyRound
                className="ml-4 h-5 w-5 text-neutral-600"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <input
                id="code"
                name="code"
                type="text"
                inputMode={useRecoveryCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                placeholder={useRecoveryCode ? "xxxxx-xxxxx" : "123456"}
                required
                className="h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700"
              />
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
            <span>{isPending ? "Verifying..." : "Verify"}</span>
          </button>
        </form>

        <button
          type="button"
          onClick={() => setUseRecoveryCode((value) => !value)}
          className="mt-6 text-sm text-neutral-500 underline decoration-[#333333] underline-offset-4 transition-colors hover:text-white"
        >
          {useRecoveryCode
            ? "Use an authenticator code instead"
            : "Use a recovery code instead"}
        </button>
      </div>
    </main>
  );
}

export default function TwoFactorChallengePage() {
  return (
    <Suspense fallback={null}>
      <TwoFactorChallengeContent />
    </Suspense>
  );
}
