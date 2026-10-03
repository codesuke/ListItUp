import { Check, ChevronDown } from "lucide-react";

// One disclosure pattern for every "pick one of a few options" toolbar
// control in the calm world (My Tasks' Workspace/Sort/Group, List Browsing's
// Status/Member) — a native <details> so each one collapses to a single
// compact trigger (no JS, no always-visible row of pill buttons competing
// for attention) instead of Section B's chip-row pattern this replaces.
// Pair with DismissOpenDisclosures so an outside click/Escape closes it.
export function OptionsDisclosure({
  label,
  currentLabel,
  options,
}: {
  label: string;
  currentLabel: string;
  options: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <details data-disclosure className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[13px] transition-colors hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-ink">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 text-ink-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-[8px] border border-line bg-surface-2 p-1 shadow-md">
        {options.map((option) => (
          <a
            key={option.key}
            href={option.href}
            className={
              option.active
                ? "block rounded-[5px] bg-surface-3 px-2.5 py-1.5 text-[13px] text-ink"
                : "block rounded-[5px] px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            }
          >
            {option.label}
          </a>
        ))}
      </div>
    </details>
  );
}

// A binary switch, not a pick-one list, so it stays a direct toggle link
// styled like a row checkbox rather than joining OptionsDisclosure above.
export function FilterToggleLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[13px] transition-colors hover:bg-surface-3"
    >
      <span
        className={
          active
            ? "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] bg-ink"
            : "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-line-strong"
        }
      >
        {active && <Check className="h-2.5 w-2.5 text-surface-2" />}
      </span>
      <span className={active ? "text-ink" : "text-ink-muted"}>{label}</span>
    </a>
  );
}
