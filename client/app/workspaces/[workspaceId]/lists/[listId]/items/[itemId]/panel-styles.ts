// Shared style constants for the Item detail panel and its sub-components
// (FieldSelect, AutoSaveCustomField, …) — kept in one place so every
// control on the page and in the drawer stays visually identical instead
// of each file re-deriving its own copy of the same Tailwind strings.

export const FIELD_LABEL_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[10.5px] uppercase tracking-[0.08em] text-ink-faint";
// The Labels chip style — a fully-rounded pill. Kept as its own constant
// (distinct from the Properties-strip chips below) since Labels chips
// weren't asked to change shape, only the always-open add controls beside
// them were.
export const CHIP_CLASS =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-2.5 py-1 text-[12px] text-ink-muted animate-in fade-in-0 zoom-in-95 duration-150";
// The Properties-strip chip style (Status/Priority/Assignee/Due date) — a
// compact rounded-rect pill, not the fully-rounded Labels shape. Static
// display version (a <span>); PROPERTY_CHIP_CONTROL_CLASS below is the same
// footprint for an interactive <select>/<input>. No text color baked in so
// callers can apply exactly one color class (e.g. red for High priority)
// without fighting an existing one in plain string concatenation.
export const PROPERTY_CHIP_CLASS =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-line-strong bg-surface-3 px-[11px] py-[6px] text-[12.5px]";
export const PROPERTY_CHIP_CONTROL_CLASS =
  "rounded-[7px] border border-line-strong bg-surface-3 px-[11px] py-[6px] text-[12.5px] transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none";
// The "+ Label" / "+ Assignee" add-control trigger — a dashed chip at the
// same footprint as PROPERTY_CHIP_CLASS, matching the properties strip
// instead of the plain text link used for the empty-state sections below.
export const DASHED_ADD_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-[7px] border border-dashed border-line-strong px-[11px] py-[6px] text-[12.5px] text-ink-faint transition-colors duration-150 hover:border-[#ff6b4a] hover:text-ink-muted";
// Fixed 30x30 footprint (not self-stretch — this sits beside a multi-line
// title block, not a single-line input, so stretching to match sibling
// height blew this up into a full-height bar). No border/background until
// hovered, so it reads as a quiet icon button, not a boxed control.
export const OVERFLOW_BTN_CLASS =
  "flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center self-start rounded-[6px] border border-transparent text-ink-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-3 hover:text-ink";
// self-stretch (not a fixed height) so this always matches the rendered
// height of the input/select it sits beside in a flex row, regardless of
// that row's font size or padding — a fixed h-6 drifted out of sync with
// INPUT_CLASS and looked visibly shorter than its sibling control. Sits at
// the same bg-surface-3 elevation as INPUT_CLASS below, one step up from
// GHOST_BUTTON_CLASS's resting state, since it doubles as this row's submit.
// Only ever placed beside a single-line control (never the multi-line
// title block — that's OVERFLOW_BTN_CLASS above).
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
// The brand-orange "commit" identity, sized for the one remaining inline,
// row-level Save (Personal note) that sits in an already-compact context —
// every other field on this panel now auto-saves without a button.
export const COMPACT_PRIMARY_BUTTON_CLASS =
  "rounded-[6px] bg-[#ff6b4a] px-2.5 py-1 text-[11.5px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]";
// Every section below the Properties strip shares this wrapper so spacing
// and the divider rhythm stay consistent regardless of how much content a
// section has, instead of each block picking its own ad hoc gap.
export const SECTION_CLASS = "flex flex-col gap-3 border-t border-line-strong/60 pt-5";
// The first section after the Properties strip uses this instead, the same
// way the page heading never gets a leading divider.
export const FIRST_SECTION_CLASS = "flex flex-col gap-3";
// The heading + primary form is always the first block on the page, so it
// never gets a leading divider.
export const HEADING_SECTION_CLASS = "flex flex-col gap-3";
// The single content column below the Properties strip. Re-establishes its
// own container-query context (`@container`) sized to its own rendered
// width, so the field-grid breakpoints below react to the column's actual
// width — not the viewport's — and never overflow the 380px Item drawer
// the way a `sm:`-viewport breakpoint would.
export const COLUMN_CLASS = "@container flex min-w-0 flex-col gap-5";
// `@lg` (container query), not `sm` (viewport), for the same reason as
// COLUMN_CLASS above: this panel also renders inside the 380px Item
// drawer, and a viewport breakpoint would widen this control past the
// drawer's content width on any normal desktop viewport regardless of how
// narrow the drawer itself is rendering.
export const BOUNDED_CONTROL_CLASS = "w-full @lg:w-56";
