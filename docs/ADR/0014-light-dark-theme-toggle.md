# Light/Dark Theme Toggle

`DESIGN.md` originally mandated "a focused, dark operational workspace style" with no light-mode consideration, and the `client/` implementation matched that: every screen hardcodes exact hex values (`bg-[#080808]`, `text-[#e5e5e0]`, etc.) rather than theme-aware tokens. The user asked for a light/dark toggle beside the Export CSV button in the List navbar; delivering a real toggle (rather than a cosmetic button that does nothing) means reversing the dark-only mandate and reworking color usage app-wide, so it's recorded here rather than treated as a routine styling tweak.

## Decision

- Add `next-themes` with a class-based `ThemeProvider` in `app/layout.tsx`, defaulting to `dark` (no `enableSystem`) so existing behavior is unchanged until a user opts into light mode.
- Introduce a small set of structural CSS variables in `app/globals.css` (`--canvas`, `--surface-1..4`, `--line`, `--line-strong`, `--ink`, `--ink-muted`, `--ink-faint`), registered as Tailwind color tokens via `@theme inline`. Dark values are copied verbatim from the current hardcoded hex so dark mode is pixel-identical to before. Light values are a new warm off-white palette designed to preserve the same elevation/hierarchy language.
- Only **structural** colors (canvas/surface/border/text) are tokenized and theme-aware. Brand color (`#ff6b4a` / `#ff8a70`), the dark "text-on-primary" color used on orange buttons/badges (`#1a0800`), and semantic status colors (priority, item state, notification type — green/amber/red/blue/gray) stay constant hex across both themes. Status colors encode meaning independent of theme, and re-deriving a whole second set of state colors for light mode wasn't worth the added surface area for this pass.
- Scope excludes the pre-authentication funnel (`sign-in`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`, `two-factor`, `accept-invitation`, `components/auth/*`). Those screens use a distinct dark "terrain grid" brand treatment (`AuthStatusPane`, `.auth-terrain-grid` in `globals.css`) that's a fixed cinematic moment, not part of the operational app shell — they stay dark-only, same as before.
- The toggle itself (`components/theme-toggle.tsx`, sun/moon icons from `lucide-react`) is a single global control placed in the List page's navbar beside Export CSV, since theme state is app-wide via `next-themes`/`localStorage` regardless of where the control lives.

## Status

accepted

## Consequences

- `DESIGN.md`'s "dark operational workspace style" language now describes the default theme, not the only theme; a follow-up pass to `DESIGN.md` should fold in the light palette once it's had real design review.
- The light palette introduced here (`#ECEAE4` canvas, `#FFFFFF` cards, `#16130F` ink, etc.) is a reasonable first pass, not a designed-and-approved system — expect it to get tuned.
- Any new screen or component that needs a structural background/border/text color should use the `canvas`/`surface-*`/`line*`/`ink*` tokens instead of hardcoded hex, or it will silently stay dark-only.
- If a future feature needs status colors to also adapt per theme (e.g. contrast issues on the light canvas), that's a separate decision — this ADR only covers structural colors.
