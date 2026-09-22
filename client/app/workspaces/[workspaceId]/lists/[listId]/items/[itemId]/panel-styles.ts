// Shared style constants for the Item detail panel and its sub-components
// (FieldSelect, AutoSaveCustomField, …) — kept in one place so every
// control on the page and in the drawer stays visually identical instead
// of each file re-deriving its own copy of the same Tailwind strings.

export const FIELD_LABEL_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[10.5px] uppercase tracking-[0.08em] text-ink-faint";
export const CHIP_CLASS =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-2.5 py-1 text-[12px] text-ink-muted animate-in fade-in-0 zoom-in-95 duration-150";
// Same visual weight as CHIP_CLASS above, but for an interactive control
// (a <select> or date <input>) rather than a static span — used by the
// Properties strip so Priority/Due date read as chips, not input boxes.
export const CHIP_CONTROL_CLASS =
  "rounded-full border border-line-strong bg-surface-3 px-2.5 py-1 text-[12px] text-ink-muted transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none";
// self-stretch (not a fixed height) so this always matches the rendered
// height of the input/select it sits beside in a flex row, regardless of
// that row's font size or padding — a fixed h-6 drifted out of sync with
// INPUT_CLASS and looked visibly shorter than its sibling control. Sits at
// the same bg-surface-3 elevation as INPUT_CLASS below, one step up from
// GHOST_BUTTON_CLASS's resting state, since it doubles as this row's submit.
export const SMALL_ICON_BTN_CLASS =
  "flex w-8 flex-shrink-0 items-center justify-center self-stretch rounded-[6px] border border-line-strong bg-surface-3 text-ink-muted transition-colors duration-150 hover:bg-surface-4 hover:text-ink";
export const INPUT_CLASS =
  "rounded-[6px] border border-line-strong bg-surface-3 px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none";
// Secondary actions (Attach, Link, Add Note, Restore, …). A filled surface,
// not just a border on transparent background, so it always reads as a
// pressable control — resting one step below the surface-3 inputs and
// stepping up to surface-4 on hover, the same elevation logic as every
// other control on this page.
export const GHOST_BUTTON_CLASS =
  "rounded-[6px] border border-line-strong bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-150 hover:border-[#ff6b4a] hover:bg-surface-4 hover:text-ink";
// The one truly primary, data-committing action on this panel: the
// title/section form's Save. Every other action (Add, Link, Attach,
// Restore, …) stays on GHOST_BUTTON_CLASS so the page has exactly one loud
// color, not six.
export const PRIMARY_BUTTON_CLASS =
  "rounded-[6px] bg-[#ff6b4a] px-3 py-1.5 text-[12.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]";
// Same orange identity as PRIMARY_BUTTON_CLASS, sized down for the one
// remaining inline, row-level Save (Personal note) that sits in an
// already-compact context.
export const COMPACT_PRIMARY_BUTTON_CLASS =
  "rounded-[6px] bg-[#ff6b4a] px-2.5 py-1 text-[11.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]";
// Every section below the Properties strip shares this wrapper so spacing
// and the divider rhythm stay consistent regardless of how much content a
// section has, instead of each block picking its own ad hoc gap.
export const SECTION_CLASS = "flex flex-col gap-3 border-t border-line-strong/60 pt-6";
// The first section after the Properties strip uses this instead, the same
// way the page heading never gets a leading divider.
export const FIRST_SECTION_CLASS = "flex flex-col gap-3";
// The heading + primary form is always the first block on the page, so it
// never gets a leading divider.
export const HEADING_SECTION_CLASS = "flex flex-col gap-4";
// The single content column below the Properties strip. Re-establishes its
// own container-query context (`@container`) sized to its own rendered
// width, so the field-grid breakpoints below react to the column's actual
// width — not the viewport's — and never overflow the 380px Item drawer
// the way a `sm:`-viewport breakpoint would.
export const COLUMN_CLASS = "@container flex min-w-0 flex-col gap-8";
// `@lg` (container query), not `sm` (viewport), for the same reason as
// COLUMN_CLASS above: this panel also renders inside the 380px Item
// drawer, and a viewport breakpoint would widen this control past the
// drawer's content width on any normal desktop viewport regardless of how
// narrow the drawer itself is rendering.
export const BOUNDED_CONTROL_CLASS = "w-full @lg:w-56";
