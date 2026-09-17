export type StatusBadgeTone = "red" | "amber" | "blue" | "green" | "muted";

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  red: "bg-[#f2545b24] text-[#f2545b]",
  amber: "bg-[#f5b64224] text-[#f5b642]",
  blue: "bg-[#5b9dff24] text-[#5b9dff]",
  green: "bg-[#3ecf8e24] text-[#3ecf8e]",
  muted: "bg-surface-4 text-ink-muted",
};

export function StatusBadge({ tone, children }: { tone: StatusBadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-[5px] px-[7px] py-[2px] font-[family-name:var(--font-mono-label)] text-[10px] font-semibold tracking-[0.05em] ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
