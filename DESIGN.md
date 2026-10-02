---
version: "listitup-design-reference-2026-10-02"
name: "ListItUp"
description: "ListItUp runs two visual worlds side by side mid-migration: a calm, quiet Inter-only world on Home and the shared app shell, and the legacy dark operational HUD world (Inter + JetBrains Mono labels, bordered panels, colored pill badges) everywhere else."
colors:
  brand-orange: "#FF6B4A"
  accent-attention-light: "#9A3412"
  accent-attention-dark: "#FF6B4A"
  canvas-light: "#ECECEC"
  surface-1-light: "#F5F5F5"
  surface-2-light: "#FFFFFF"
  surface-3-light: "#E4E4E4"
  surface-4-light: "#DEDEDE"
  line-light: "#DADADA"
  line-strong-light: "#C7C7C7"
  ink-light: "#16130F"
  ink-muted-light: "#55524A"
  ink-faint-light: "#8B8778"
  canvas-dark: "#080808"
  surface-1-dark: "#0d0d0d"
  surface-2-dark: "#141414"
  surface-3-dark: "#1a1a1a"
  surface-4-dark: "#202020"
  line-dark: "#232323"
  line-strong-dark: "#333333"
  ink-dark: "#e5e5e0"
  ink-muted-dark: "#8f8f8a"
  ink-faint-dark: "#5a5a56"
  legacy-secondary: "#333333"
  legacy-background-first-pass: "#E5E5E0"
  legacy-status-red: "#f2545b"
  legacy-status-amber: "#f5b642"
  legacy-status-blue: "#5b9dff"
  legacy-status-green: "#3ecf8e"
typography:
  calm-body:
    fontFamily: "Inter (next/font Geist Sans stack)"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  calm-heading-primary:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "1.3"
  calm-page-title:
    fontFamily: "Inter"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  legacy-label-mono:
    fontFamily: "JetBrains Mono"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.05em"
spacing:
  base: "8px"
  gap: "16px"
  section-gap-calm: "56px"
rounded:
  control: "6px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange}"
---

# ListItUp Design System

**This file now documents two live, divergent visual worlds.** As of this pass, Home (`client/app/workspaces/[workspaceId]/page.tsx`) and the shared app shell (`WorkspaceSidebar.tsx`, `GlobalHeaderActions.tsx`, `HomeBreadcrumb.tsx`, `theme-toggle.tsx`) were rebuilt into a calm, quiet world. Every other screen — My Tasks, Updates, Lists, Items, Settings, Profile, and the pre-auth funnel — still runs the original dark operational-HUD world exactly as shipped before this pass. **The two sections below are both normative for their respective scope.** Do not apply Section A rules to old-world screens, and do not apply Section B rules to Home/shell work, until each screen is explicitly redesigned.

Tags: dashboard, calm productivity tool, operational UI (legacy), lists, capture, workspace, dual-world mid-migration.

---

## A. The Calm World (current) — Home + shared app shell

**Scope:** `client/app/workspaces/[workspaceId]/page.tsx`, `HomeWidgets.tsx`, `WorkspaceSidebar.tsx`, `GlobalHeaderActions.tsx`, `HomeBreadcrumb.tsx`, `components/theme-toggle.tsx`, and the light/dark structural tokens in `client/app/globals.css` that both worlds share (`--canvas`, `--surface-1..4`, `--line`, `--line-strong`, `--ink`, `--ink-muted`, `--ink-faint`, `--accent-attention`).

### Overview

Home rejects the dashboard-of-widget-cards arrangement. It reads as a single calm task list, not an operational console: quiet header, one dominant unbordered task list, a secondary two-column band below a single hairline rule. The explicit anti-reference is the old dark-HUD register (dense bordered panels, mono-uppercase labels, colored pill badges) that the user rejected as generic AI-SaaS.

**Key Characteristics:**
- One type family (Inter) end to end — no monospace anywhere in this scope, even though `--font-mono-label` is still loaded globally by `AppShell.tsx` for old-world consumers.
- Brand orange appears in exactly three places: the primary action, the active-nav indicator, and the current-workspace row in the switcher. Nowhere else.
- Status is plain colored text, never a pill/badge.
- No card borders as the default content separator; sections are grouped by spacing and a plain heading.
- Clear primary/secondary hierarchy: "My Tasks" dominates; "Recent Lists"/"Assigned to Others" are visually subordinate below a hairline rule.

### Colors

Structural tokens (`canvas`, `surface-1..4`, `line`, `line-strong`, `ink`, `ink-muted`, `ink-faint`) are shared with the old world and theme-aware; this pass rebalanced the **light** theme to true neutral gray (R=G=B — e.g. `surface-1-light` `#F5F5F5`, `line-light` `#DADADA`, `ink-light` `#16130F`), replacing an earlier light pass that had drifted warm/cream. Dark-theme values are unchanged from the pre-existing operational theme.

#### Primary
- **Brand Orange** (`#FF6B4A`, constant across themes): the primary action, the sidebar active-nav accent bar, and the current-workspace-selection row in the switcher dropdown. Nothing else in this scope uses it — no badges, no decoration, no links.

#### Neutral
- **Canvas** (`#ECECEC` light / `#080808` dark): page background.
- **Surface 1–4**: layered UI surfaces (header bar, row hover, dropdown, etc.), lightest-to-darkest-contrast progression.
- **Line / Line Strong**: hairlines — the header-bottom border, the sidebar-vs-canvas seam, the single rule between the primary and secondary band, dropdown borders.
- **Ink / Ink Muted / Ink Faint**: text hierarchy. `ink` for primary text and row titles, `ink-muted` for all secondary/informational text (due dates, item counts, section labels, empty states).

#### Status
- **Accent Attention** (`#9A3412` light / `#FF6B4A` dark, theme-aware token `--accent-attention`): the one color-bearing status signal, "overdue," applied to text only. Introduced specifically because raw brand orange fails body-text contrast on the rebalanced light canvas — this is a deliberate departure from the "brand orange is constant across themes" rule, scoped to this one semantic use.

### Named Rules
**The Three Uses Rule.** Brand orange appears in exactly three places on Home/shell: the primary action, the active-nav indicator, and the current-workspace row in the switcher. If a new element wants orange, it is not one of these three and should not get it.

**The No-Pill-Status Rule.** Status (overdue, blocked, due, complete) is communicated by plain colored/weighted text (`DueDateText` / `dueDateStatus()` in `HomeWidgets.tsx`), never a colored-background pill or badge. This is a direct rejection of the old world's `StatusBadge` pattern for this scope.

**The Ink-Muted-Not-Faint Rule.** Secondary/informational text (due dates, counts, labels, empty states) uses `--ink-muted`. `--ink-faint` fails WCAG body-text contrast (~2.9:1) against `--canvas` in the light theme and must not be used for informational text — in this scope or, going forward, anywhere in the app.

### Typography

**Body/UI Font:** Inter (via the app's Geist Sans `next/font` stack) — no fallback to a second family anywhere in this scope.

**Character:** One quiet, legible sans voice; weight and size carry hierarchy instead of a second typeface or case transform.

#### Hierarchy
- **Page Title** (600, 24px, tight tracking): the greeting line ("Good morning, Name").
- **Primary Section Heading** (600, 16px): "My Tasks" — the dominant heading on the page.
- **Secondary Section Heading** (500, 12px, uppercase, `ink-muted`): "Recent Lists" / "Assigned to Others" — the one remaining uppercase-label use in this world, but set in Inter, not mono.
- **Row Body** (400, 14px): task titles, list names.
- **Meta/Status** (400, 12px, `ink-muted` or `accent-attention`): due dates, item counts, "View all" links.

### Layout

Home is a centered `max-w-4xl` column inside a full-bleed canvas, with generous page gutters (`px-10`) and a quiet `60px` header. Vertical rhythm: `mb-12` under the greeting, `mt-14` before the secondary band, `pt-10`/`gap-y-10` around the hairline rule. The primary task list is full-width; the secondary band below the rule is a two-column grid (`grid-cols-2 gap-x-12`).

### Elevation & Depth

Flat by default. No shadows and no card borders as a content separator anywhere in this scope. A visible border is reserved for two cases: the sidebar-vs-canvas seam (`border-line`) and true overlays (the workspace-switcher dropdown, the search palette), which do get a border plus a soft `shadow-md`.

### Named Rules
**The Spacing-Not-Borders Rule.** Content sections (My Tasks, Recent Lists, Assigned to Others) are separated by spacing and a plain heading, never a bordered/elevated card. The only border inside the content column is the single hairline rule between the primary and secondary band.

### Shapes

Controls use a modest `6px` radius (buttons, hover rows, dropdown). Avatars and status dots are fully circular. No pill-shaped chrome in this scope (contrast with the old world's badge pills).

### Components

#### Sidebar Navigation
- **Active state:** a quiet 2px inset-left orange accent bar (`shadow-[inset_2px_0_0_0_#ff6b4a]`) plus the primitive's existing font-weight bump. The shared sidebar primitive's own neutral `data-active` background fill is explicitly suppressed (`data-active:bg-transparent`) — this is not a tinted pill.
- **Group labels:** small uppercase Inter, not mono.
- **Workspace switcher:** a bordered, shadowed dropdown (a legitimate overlay); the current-workspace row is the one place besides the active-nav bar and the primary action that brand orange appears (`#ff8a70` tint on the row text).

#### Header Icon Buttons
- 8×8 (`h-8 w-8`) square buttons, `6px` radius, `ink-muted` icon at rest, `surface-3` hover background, `ink` hover icon color. Shared by search, theme toggle, and notifications (`GlobalHeaderActions.tsx`, `theme-toggle.tsx`).

#### Task Row (signature component)
A plain unbordered row: a circular checkbox/complete indicator, a truncated title link, and optional trailing status text. Hover state is a `surface-2` background wash, not a border or shadow. Complete items get a filled orange circle with a check glyph and strikethrough/muted title text.

### Do's and Don'ts

#### Do:
- **Do** keep this scope single-family Inter; don't introduce `--font-mono-label` here even though it's loaded for other screens.
- **Do** use `--ink-muted` for all secondary/informational text; never `--ink-faint`.
- **Do** separate content sections with spacing and a plain heading, not a card border.
- **Do** keep brand orange to the three named uses.

#### Don't:
- **Don't** add a colored-background status pill/badge to Home or the shell — status is text color only.
- **Don't** add a bordered card around a content section as the default container.
- **Don't** reuse `components/workspace/StatusBadge.tsx` or `components/workspace/MemberAvatar.tsx` in this scope — they carry the old world's mono-label styling; `HomeWidgets.tsx` has its own local Inter-set `AssigneeAvatar` for this reason.

---

## B. The Legacy Operational World (unchanged) — everywhere else

**Scope:** `app/my-tasks`, `app/updates`, `app/workspaces/[workspaceId]/lists/**`, `app/workspaces/[workspaceId]/settings`, `app/settings/**`, `app/profile`, `app/users/**`, the pre-auth funnel (sign-in/up, password reset, email verification, invitations), and shared components `StatusBadge.tsx`, `MemberAvatar.tsx`, `ListStatusPill.tsx`, and any other consumer of `--font-mono-label`. This section is preserved from the prior DESIGN.md; it was not re-verified against the build in this pass beyond confirming these files still exist and still use it.

Source reference: `sample.html`. The operational app shell previously described as the whole app's default ("Nexus Protocol" derived) is now accurate only for this scope.

### Overview

A focused, dark operational workspace style: structured, fast, serious without being heavy. Emphasizes immediate capture, scannable lists, compact navigation groups, subtle borders, ambient motion, clear hierarchy. Supports a light theme via a user-facing toggle (ADR 0014); dark is the default. The pre-authentication funnel renders dark only.

### Colors

Primary `#FF6B4A`, secondary `#333333`, accent `#FF8A70`, an original background of `#E5E5E0` (light-theme first pass — note the structural light tokens this screen family draws on, `--canvas`/`--surface-*`/`--line`/`--ink`, were rebalanced to true neutral gray in this pass per Section A; this legacy scope inherits that rebalance since it's the same CSS variables, even though its component-level patterns were not touched). Status badges use a fixed four-tone palette: red `#f2545b`, amber `#f5b642`, blue `#5b9dff`, green `#3ecf8e`, each at `~14%` background opacity with full-opacity text (`StatusBadge.tsx`).

### Typography

Inter for display moments; **JetBrains Mono for labels and technical metadata** (`--font-mono-label`, loaded in `AppShell.tsx`) — status badges, member-avatar initials, and other uppercase chrome in this scope.

### Layout

Keep spacing deliberate and stable; favor the grid direction, max-width behavior, card density, and responsive stacking seen in `sample.html`. Primary app screens use full available page width with generous gutters.

### Components

Workspace, List, Item, archive, and capture panels preserve a compact operational hierarchy with nested bordered surfaces, subtle borders, and mono-label metadata. Status is communicated via `StatusBadge` — a colored-background pill with mono-uppercase text — unlike the calm world's plain-text status. Member identity uses `MemberAvatar`, mono-set initials. Use Lucide icons; do not hand-roll SVG icons.

### Do's and Don'ts

#### Do:
- **Do** keep this scope's existing bordered-panel, mono-label language until it is explicitly redesigned — don't "fix" it opportunistically as a side effect of unrelated work.

#### Don't:
- **Don't** import the calm world's `AssigneeAvatar`-style Inter-only patterns into this scope without an explicit redesign decision, and the reverse: don't reuse `StatusBadge`/`MemberAvatar` in the calm world (Section A).
- **Don't** treat `#E5E5E0` as the current light canvas value — it was superseded by the true-neutral rebalance; this scope's screens render on the same updated tokens even though their component patterns are untouched.

---

## Known drift (not canonized, not repaired)

- The legacy world's light-theme background value recorded in older docs (`#E5E5E0`, warm/cream) is stale: the actual `--canvas`/`--surface-*` tokens were rebalanced to true neutral gray for both worlds, since they're the same CSS variables. This is drift between old documentation and current tokens, not a new design decision — flagged here, not fixed into a new legacy-world palette.
- `StatusBadge.tsx`, `MemberAvatar.tsx`, and other mono-label/pill patterns are a carried defect of the still-unmigrated screens, not a rule for future surfaces. They are documented in Section B as "what ships today," never promoted into Section A's rule set.
