"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
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

  return (
    <AuthPageShell
      kicker="Reset password"
      heroTitle="Choose a new password."
      heroCopy="Use at least 12 characters. Any passphrase you'll remember works."
    >
      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="token" value={token} />

        <AuthPasswordField
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="At least 12 characters"
          required
        />

        {state.status === "error" ? (
          <p role="alert" className="text-sm text-[#e17a6a] animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {state.message}
          </p>
        ) : null}

        <AuthSubmitButton
          pending={isPending}
          label="Update password"
          pendingLabel="Updating..."
        />
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
