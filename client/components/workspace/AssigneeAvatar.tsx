import { avatarColorForName, initialsFromName } from "@/lib/ui/member-display";

// A calm-world stand-in for MemberAvatar — that component renders initials
// in the app's old mono label font (other, as-yet unredesigned screens
// depend on it), which Section A's Inter-only scope doesn't use.
export function AssigneeAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-2 text-[10px] font-semibold text-[#1a0800]"
      style={{ backgroundColor: avatarColorForName(name) }}
      title={name}
    >
      {initialsFromName(name)}
    </span>
  );
}
