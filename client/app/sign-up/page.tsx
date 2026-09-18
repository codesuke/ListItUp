"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/auth-config";
import { signUpAction, type SignUpFormState } from "./actions";

const initialState: SignUpFormState = { status: "idle" };

function SignUpContent() {
  const searchParams = useSearchParams();
  const lockedEmail = searchParams.get("email") ?? "";
  const callbackURL = searchParams.get("callbackURL") ?? "";
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState
  );

  return (
    <AuthPageShell
      kicker="Sign up"
      heroTitle="Create your ListItUp account."
      heroCopy="Capture Items, review My Tasks, and keep shared Workspaces moving."
    >
      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="callbackURL" value={callbackURL} />

        <AuthTextField
          id="display-name"
          name="displayName"
          type="text"
          label="Display Name"
          autoComplete="name"
          placeholder="Your name"
          required
        />

        <AuthTextField
          id="email"
          name="email"
          type="email"
          label="Email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={lockedEmail}
          readOnly={Boolean(lockedEmail)}
          required
        />

        <AuthPasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="At least 12 characters"
          required
        />

        {state.status === "error" ? (
          <p role="alert" className="text-sm text-[#e17a6a]">
            {state.message}
          </p>
        ) : null}

        <AuthSubmitButton
          pending={isPending}
          label="Create account"
          pendingLabel="Creating account..."
        />
      </form>

      <p className="mt-8 text-sm text-[#a5aaaf]">
        Already have an account?{" "}
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

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  );
}
