import { avatarColorForName, initialsFromName } from "@/lib/ui/member-display";

export function MemberAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-2 font-[family-name:var(--font-mono-label)] text-[10px] font-bold text-[#1a0800]"
      style={{ backgroundColor: avatarColorForName(name) }}
      title={name}
    >
      {initialsFromName(name)}
    </span>
  );
}
