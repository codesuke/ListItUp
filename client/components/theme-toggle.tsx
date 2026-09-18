"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/use-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={
        mounted
          ? `Switch to ${isDark ? "light" : "dark"} theme`
          : "Toggle theme"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted transition-[background-color,color,transform] duration-150 hover:bg-surface-3 hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
    >
      {isDark ? (
        <Moon key="moon" className="h-[15px] w-[15px] animate-in fade-in-0 zoom-in-50 duration-200" />
      ) : (
        <Sun key="sun" className="h-[15px] w-[15px] animate-in fade-in-0 zoom-in-50 duration-200" />
      )}
    </button>
  );
}
