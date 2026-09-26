// Shared shape for every "add" trigger across the workspace UI (Section,
// per-section Add, New Task, and RevealAddControl's button variant) so they
// only ever differ by primary (filled) vs secondary (outline) emphasis, never
// by padding, radius, or font weight.
const ADD_BUTTON_BASE =
  "inline-flex flex-shrink-0 items-center gap-1.5 rounded-[6px] px-3 py-[7px] text-[13px] font-semibold transition-colors duration-150";

export const ADD_BUTTON_PRIMARY = `${ADD_BUTTON_BASE} bg-[#ff6b4a] text-[#1a0800] hover:bg-[#ff8a70]`;

export const ADD_BUTTON_SECONDARY = `${ADD_BUTTON_BASE} border border-line-strong text-ink-muted hover:border-[#ff6b4a] hover:text-[#ff6b4a]`;
