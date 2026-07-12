"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import LineWaves from "@/components/LineWaves";
import { AmbientCanvas } from "@/components/AmbientCanvas";

interface AuthPageShellProps {
  kicker: string;
  heroTitle: string;
  heroCopy: string;
  children: ReactNode;
}

export function AuthPageShell({
  kicker,
  heroTitle,
  heroCopy,
  children,
}: AuthPageShellProps) {
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
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-neutral-400 sm:mt-6 sm:text-base">
                {heroCopy}
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
                    {kicker}
                  </span>
                </div>
              </div>

              {children}
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
