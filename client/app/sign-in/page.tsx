"use client";

import { Suspense, useActionState, useState } from "react";
import type { FocusEvent, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { AuthOAuthButtons } from "@/components/auth/AuthOAuthButtons";
import {
  requestMagicLinkAction,
  signInAction,
  type MagicLinkFormState,
  type SignInFormState,
} from "./actions";

const initialSignInState: SignInFormState = { status: "idle" };
const initialMagicLinkState: MagicLinkFormState = { status: "idle" };
const DEFAULT_CALLBACK_URL = "/";

function requiredFieldMessage(fieldName: string): string {
  return fieldName === "email"
    ? "Please enter your email address."
    : "Please enter your password.";
}

function validateField(field: HTMLInputElement): string {
  if (!field.value.trim()) return requiredFieldMessage(field.name);
  if (field.type === "email" && !field.validity.valid) {
    return "Email addresses need an @ symbol. Try: name@example.com";
  }
  return "";
}

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") ?? DEFAULT_CALLBACK_URL;
  const [signInState, signInFormAction, isSigningIn] = useActionState(
    signInAction,
    initialSignInState
  );
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [magicLinkState, magicLinkFormAction, isSendingMagicLink] =
    useActionState(requestMagicLinkAction, initialMagicLinkState);

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const message = validateField(event.target);
    if (event.target.name === "email") {
      setEmailError(message);
    } else {
      setPasswordError(message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const password = form.elements.namedItem("password") as HTMLInputElement;

    const nextEmailError = validateField(email);
    const nextPasswordError = validateField(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      event.preventDefault();
      (nextEmailError ? email : password).focus();
    }
  }

  return (
    <AuthPageShell
      kicker="Access"
      heroTitle="Welcome back."
      heroCopy="Sign in to pick up where your work left off."
    >
      {mode === "password" ? (
        <form
          action={signInFormAction}
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-4"
        >
          <input type="hidden" name="callbackURL" value={callbackURL} />

          <AuthTextField
            id="email"
            name="email"
            type="email"
            inputMode="email"
            label="Email address"
            autoComplete="email"
            placeholder="you@company.com"
            required
            error={emailError}
            onBlur={handleBlur}
          />

          <AuthPasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            error={passwordError}
            onBlur={handleBlur}
          />

          <div className="flex items-center justify-between gap-4">
            <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-[#a5aaaf]">
              <input className="peer sr-only" type="checkbox" name="remember" />
              <span
                className="grid size-4 place-items-center rounded border border-[#31363a] bg-[#0e1113] text-xs text-[#0e1113] transition-colors duration-150 peer-checked:border-[#c4581a] peer-checked:bg-[#c4581a] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#c4581a]"
                aria-hidden="true"
              >
                ✓
              </span>
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-[#c4581a] underline-offset-4 transition hover:text-[#e6e6e6] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4581a]"
            >
              Forgot password?
            </Link>
          </div>

          {signInState.status === "error" ? (
            <p role="alert" className="text-sm text-[#e17a6a]">
              {signInState.message}
            </p>
          ) : null}

          <AuthSubmitButton
            pending={isSigningIn}
            label="Sign in"
            pendingLabel="Signing in..."
            showIdleIcon={false}
          />
        </form>
      ) : (
        <form action={magicLinkFormAction} className="grid gap-4">
          <input type="hidden" name="callbackURL" value={callbackURL} />
          <AuthTextField
            id="magic-link-email"
            name="email"
            type="email"
            inputMode="email"
            label="Email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          {magicLinkState.status === "sent" ? (
            <p role="status" className="text-sm text-[#a5aaaf]">
              If that email has an account, a sign-in link is on its way.
            </p>
          ) : null}
          {magicLinkState.status === "error" ? (
            <p role="alert" className="text-sm text-[#e17a6a]">
              {magicLinkState.message}
            </p>
          ) : null}
          <AuthSubmitButton
            pending={isSendingMagicLink}
            label="Send sign-in link"
            pendingLabel="Sending..."
            showIdleIcon={false}
          />
        </form>
      )}

      <button
        type="button"
        className="mt-5 text-sm text-[#a5aaaf] underline-offset-4 transition hover:text-[#e6e6e6] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4581a]"
        onClick={() =>
          setMode((current) =>
            current === "password" ? "magic-link" : "password"
          )
        }
      >
        {mode === "password" ? "Email magic link" : "Use password instead"}
      </button>

      <AuthOAuthButtons />

      <p className="text-center text-sm text-[#a5aaaf]">
        New to ListItUp?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-[#c4581a] underline-offset-4 transition hover:text-[#e6e6e6] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4581a]"
        >
          Create an account
        </Link>
      </p>
    </AuthPageShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
