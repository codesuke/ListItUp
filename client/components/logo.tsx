"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/use-mounted";

export function Logo({ href }: { href: string }) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const src = isDark ? "/logo/lockup-dark.svg" : "/logo/lockup-light.svg";

  return (
    <Link href={href} aria-label="ListItUp home" className="flex flex-shrink-0 items-center">
      <Image src={src} alt="ListItUp" width={120} height={30} priority unoptimized />
    </Link>
  );
}
