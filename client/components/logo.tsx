import Image from "next/image";
import Link from "next/link";

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="ListItUp home" className="flex flex-shrink-0 items-center gap-2">
      <Image
        src="/brand/listitup-ribbon-concept-v3-porcelain.png"
        alt=""
        width={30}
        height={30}
        priority
        className="h-[30px] w-[30px]"
      />
      <span className="text-[19px] font-semibold tracking-tight text-ink">ListItUp</span>
    </Link>
  );
}
