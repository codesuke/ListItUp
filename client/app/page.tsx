"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Eye,
  EyeClosed,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";
import LineWaves from "@/components/LineWaves";
import { AmbientCanvas } from "@/components/AmbientCanvas";

type AuthMode = "signin" | "signup";

type ModeCopy = {
  kicker: string;
  title: string;
  copy: string;
  submit: string;
};

const modeCopy: Record<AuthMode, ModeCopy> = {
  signin: {
    kicker: "// Sign in",
    title: "Turn scattered work into clear lists.",
    copy: "Capture Items, review My Tasks, and keep shared Workspaces moving without making organization feel like another job.",
    submit: "Sign in",
  },
  signup: {
    kicker: "// Sign up",
    title: "Turn scattered work into clear lists.",
    copy: "Capture Items, review My Tasks, and keep shared Workspaces moving without making organization feel like another job.",
    submit: "Create account",
  },
};

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const copy = modeCopy[mode];
  const isSignUp = mode === "signup";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] text-neutral-300">
      <section className="grid min-h-screen w-full overflow-hidden bg-[#080808] lg:grid-cols-[70fr_30fr]">
        <div className="relative min-h-[430px] overflow-hidden border-b border-[#1a1a1a] bg-[#050505] sm:min-h-[520px] lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="absolute -inset-x-16 -inset-y-10 opacity-80 sm:-inset-x-20 lg:-inset-x-24 lg:-inset-y-12">
            <LineWaves
              speed={0.18}
              innerLineCount={28}
              outerLineCount={46}
              warpIntensity={0.68}
              rotation={-12}
              edgeFadeWidth={0}
              colorCycleSpeed={0.45}
              brightness={0.22}
              color1="#ff6b4a"
              color2="#ff8a70"
              color3="#ffffff"
              enableMouseInteraction={false}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_58%_34%,transparent_0%,rgba(8,8,8,.08)_34%,rgba(8,8,8,.74)_88%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent p-6 pl-3 pt-32 sm:p-10 sm:pl-4 sm:pt-40 lg:p-14 lg:pl-8 lg:pt-52 xl:p-16 xl:pl-10 2xl:p-20 2xl:pl-12">
            <div className="max-w-[860px]">
              <h1 className="text-3xl font-light leading-[1.08] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-neutral-400 sm:mt-6 sm:text-base">
                {copy.copy}
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-screen flex-col">
          <AmbientCanvas />

          <div className="relative z-10 flex flex-1 px-6 py-12 sm:px-10 lg:px-8 xl:px-10">
            <div className="flex w-full flex-col justify-center">
              <div className="mb-10 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <span className="h-px w-14 bg-[#ff6b4a]" />
                  <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
                    {copy.kicker}
                  </span>
                </div>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-700 sm:block">
                  Secure Access
                </span>
              </div>

              <div className="w-full">
                <div
                  className="mb-8 grid grid-cols-2 border border-[#1a1a1a] bg-[#0b0b0b]/80 p-1.5"
                  role="tablist"
                  aria-label="Authentication mode"
                >
                  <button
                    type="button"
                    className={`px-5 py-4 text-sm transition-colors ${
                      mode === "signin"
                        ? "bg-[#ff6b4a] font-medium text-black"
                        : "bg-transparent text-neutral-500 hover:text-white"
                    }`}
                    role="tab"
                    aria-selected={mode === "signin"}
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`px-5 py-4 text-sm transition-colors ${
                      mode === "signup"
                        ? "bg-[#ff6b4a] font-medium text-black"
                        : "bg-transparent text-neutral-500 hover:text-white"
                    }`}
                    role="tab"
                    aria-selected={mode === "signup"}
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </div>

                <form className="grid gap-5" onSubmit={handleSubmit}>
                  {isSignUp ? (
                    <div className="group">
                      <label
                        htmlFor="display-name"
                        className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
                      >
                        Display Name
                      </label>
                      <div className="flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]">
                        <UserRound
                          className="ml-4 h-5 w-5 text-neutral-600"
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                        <input
                          id="display-name"
                          name="displayName"
                          type="text"
                          autoComplete="name"
                          placeholder="Your name"
                          required
                          className="h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700"
                        />
                      </div>
                    </div>
                  ) : null}

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
                        href="/reset-password"
                        className="text-xs text-neutral-500 underline decoration-[#333333] underline-offset-4 transition-colors hover:text-white"
                      >
                        Reset password
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
                        autoComplete={
                          isSignUp ? "new-password" : "current-password"
                        }
                        placeholder="Enter password"
                        className="h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700"
                      />
                      <button
                        type="button"
                        className="relative grid h-[58px] w-[58px] place-items-center overflow-hidden text-neutral-600 transition-colors hover:text-white"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        <span className="relative grid h-6 w-6 place-items-center">
                          <Eye
                            className={`absolute h-5 w-5 transition-all duration-300 ease-out ${
                              showPassword
                                ? "-translate-y-1 scale-90 opacity-0"
                                : "translate-y-0 scale-100 opacity-100"
                            }`}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                          <EyeClosed
                            className={`absolute h-5 w-5 transition-all duration-300 ease-out ${
                              showPassword
                                ? "translate-y-0 scale-100 opacity-100"
                                : "translate-y-1 scale-90 opacity-0"
                            }`}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-4 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808]"
                  >
                    <span>{copy.submit}</span>
                    <ArrowUpRight
                      className="h-5 w-5"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </button>
                </form>

                <div className="mt-9 border-t border-[#1a1a1a] pt-7">
                  <Link
                    href="/magic-link"
                    className="group flex min-h-[58px] items-center justify-between border border-[#1a1a1a] bg-[#0b0b0b]/80 px-5 py-4 transition-colors hover:border-[#333333] hover:bg-[#101010]/80"
                  >
                    <span className="text-sm text-neutral-500 transition-colors group-hover:text-white">
                      Email magic link
                    </span>
                    <Sparkles
                      className="h-5 w-5 text-[#ff6b4a]"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <footer className="relative z-10">
            <div className="flex w-full flex-col gap-2 px-6 pb-5 text-xs text-neutral-700 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16 xl:px-24">
              <span>2026 ListItUp</span>
              <Link
                href="/privacy"
                className="transition-colors hover:text-neutral-500"
              >
                Privacy
              </Link>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
