"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Eye,
  EyeClosed,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import {
  requestMagicLinkAction,
  signInAction,
  type MagicLinkFormState,
  type SignInFormState,
} from "./actions";

const initialSignInState: SignInFormState = { status: "idle" };
const initialMagicLinkState: MagicLinkFormState = { status: "idle" };
const DEFAULT_CALLBACK_URL = "/my-tasks";

type SignInMode = "password" | "magic-link";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") ?? DEFAULT_CALLBACK_URL;
  const [mode, setMode] = useState<SignInMode>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [signInState, signInFormAction, isSigningIn] = useActionState(
    signInAction,
    initialSignInState
  );
  const [magicLinkState, magicLinkFormAction, isSendingMagicLink] =
    useActionState(requestMagicLinkAction, initialMagicLinkState);

  return (
    <AuthPageShell
      kicker="// Sign in"
      heroTitle="Turn scattered work into clear lists."
      heroCopy="Capture Items, review My Tasks, and keep shared Workspaces moving without making organization feel like another job."
    >
      {mode === "password" ? (
        <form action={signInFormAction} className="grid gap-5">
          <input type="hidden" name="callbackURL" value={callbackURL} />

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

          <div className="group">
            <div className="mb-3 flex items-center justify-between gap-4">
              <label
                htmlFor="password"
                className="block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-neutral-500 underline decoration-[#333333] underline-offset-4 transition-colors hover:text-white"
              >
                Forgot password?
              </Link>
            </div>
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
                autoComplete="current-password"
                placeholder="Enter password"
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
                  <Eye
                    className="h-5 w-5"
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>

          {signInState.status === "error" ? (
            <p role="alert" className="text-sm text-[#ff8a70]">
              {signInState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSigningIn}
            className="mt-4 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{isSigningIn ? "Signing in..." : "Sign in"}</span>
            <ArrowUpRight
              className="h-5 w-5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        </form>
      ) : (
        <form action={magicLinkFormAction} className="grid gap-5">
          <input type="hidden" name="callbackURL" value={callbackURL} />

          <div className="group">
            <label
              htmlFor="magic-link-email"
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
                id="magic-link-email"
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
            disabled={isSendingMagicLink}
            className="mt-4 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {isSendingMagicLink ? "Sending..." : "Send sign-in link"}
            </span>
            <ArrowUpRight
              className="h-5 w-5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>

          {magicLinkState.status === "sent" ? (
            <p role="status" className="text-sm text-neutral-500">
              If that email has an account, a sign-in link is on its way.
            </p>
          ) : null}
          {magicLinkState.status === "error" ? (
            <p role="alert" className="text-sm text-[#ff8a70]">
              {magicLinkState.message}
            </p>
          ) : null}
        </form>
      )}

      <div className="mt-9 border-t border-[#1a1a1a] pt-7">
        <button
          type="button"
          onClick={() =>
            setMode((current) =>
              current === "password" ? "magic-link" : "password"
            )
          }
          className="group flex min-h-[58px] w-full items-center justify-between border border-[#1a1a1a] bg-[#0b0b0b]/80 px-5 py-4 text-left transition-colors hover:border-[#333333] hover:bg-[#101010]/80"
        >
          <span className="text-sm text-neutral-500 transition-colors group-hover:text-white">
            {mode === "password" ? "Email magic link" : "Use password instead"}
          </span>
          <Sparkles
            className="h-5 w-5 text-[#ff6b4a]"
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
      </div>

      <p className="mt-8 text-sm text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="text-white underline decoration-[#333333] underline-offset-4 hover:decoration-[#ff6b4a]"
        >
          Sign up
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
