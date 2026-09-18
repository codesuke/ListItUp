"use client";

import { useActionState } from "react";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
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
      kicker="Reset password"
      heroTitle="Forgot your password?"
      heroCopy="We'll email you a link to choose a new one."
    >
      <form action={formAction} className="grid gap-5">
        <AuthTextField
          id="email"
          name="email"
          type="email"
          label="Email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />

        <AuthSubmitButton
          pending={isPending}
          label="Send reset link"
          pendingLabel="Sending..."
        />

        {state.status === "sent" ? (
          <p role="status" className="text-sm text-[#a5aaaf]">
            If that email has an account, a reset link is on its way.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-[#e17a6a]">
            {state.message}
          </p>
        ) : null}
      </form>

      <p className="mt-8 text-sm text-[#a5aaaf]">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="text-[#e6e6e6] underline decoration-[#31363a] underline-offset-4 transition-colors duration-150 hover:decoration-[#c4581a]"
        >
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
