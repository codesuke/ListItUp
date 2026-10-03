---
version: "listitup-design-reference-2026-10-03-r3"
name: "ListItUp"
description: "ListItUp runs two visual worlds side by side mid-migration: a calm, quiet Inter-only world on Home (now refined with one structured, elevated primary panel and grouped task sections), the shared app shell, My Tasks' List/Board/Calendar/Files tabs, and workspace Lists (both the Lists browsing page and a List's own Overview/List/Board/Calendar/Timeline/Files tabs), and the legacy dark operational HUD world (Inter + JetBrains Mono labels, bordered panels, colored pill badges) everywhere else, including both My Tasks' and a List's own Dashboard tab."
colors:
  brand-orange: "#FF6B4A"
  accent-attention-light: "#9A3412"
  accent-attention-dark: "#FF6B4A"
  accent-blocked-light: "#8A5A00"
  accent-blocked-dark: "#F5B642"
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
  calm-subheading-group:
    fontFamily: "Inter"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.03em"
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
  panel: "16px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange}"
---

# ListItUp Design System

**This file now documents two live, divergent visual worlds.** Home (`client/app/workspaces/[workspaceId]/page.tsx`) and the shared app shell (`WorkspaceSidebar.tsx`, `GlobalHeaderActions.tsx`, `HomeBreadcrumb.tsx`, `theme-toggle.tsx`) were rebuilt into a calm, quiet world first, then refined in a second round to add back structure and depth; a later pass carried that world to My Tasks' List, Board, Calendar, and Files tabs (`app/my-tasks/page.tsx` and its view components, excluding `DashboardView.tsx`); a further pass carried it to workspace Lists — both the Lists browsing page (`app/workspaces/[workspaceId]/lists/page.tsx`) and a List's own Overview/List/Board/Calendar/Timeline/Files tabs (`app/workspaces/[workspaceId]/lists/[listId]/page.tsx` and its view components, excluding `DashboardTab.tsx`). Every other screen — both Dashboard tabs, Updates, Items (the `items/[itemId]` detail page and drawer), Settings, Profile, and the pre-auth funnel — still runs the original dark operational-HUD world exactly as shipped before any of these passes. **The two sections below are both normative for their respective scope.** Do not apply Section A rules to old-world screens, and do not apply Section B rules to migrated work, until each screen is explicitly redesigned.

Tags: dashboard, calm productivity tool, operational UI (legacy), lists, capture, workspace, dual-world mid-migration.

---

## A. The Calm World (current) — Home, shared app shell, My Tasks (List/Board/Calendar/Files), and workspace Lists (browsing + List detail, minus Dashboard)

**Scope:** `client/app/workspaces/[workspaceId]/page.tsx`, `HomeWidgets.tsx`, `page-data.ts`, `WorkspaceSidebar.tsx`, `GlobalHeaderActions.tsx`, `HomeBreadcrumb.tsx`, `components/theme-toggle.tsx`; `app/my-tasks/page.tsx`, `MyTasksList.tsx`, `QuickAddForm.tsx`, `SearchForm.tsx`, `CopyLinkButton.tsx`, `BoardView.tsx`, `CalendarView.tsx`, `FilesView.tsx` (**not** `DashboardView.tsx` — see Section B); `app/workspaces/[workspaceId]/lists/page.tsx`, `ListSearchForm.tsx`; `app/workspaces/[workspaceId]/lists/[listId]/page.tsx`, `ListStatusControl.tsx`, `SectionList.tsx`, `BoardView.tsx`, `CalendarView.tsx`, `FilesView.tsx`, `TimelineView.tsx`, `TimelineGrid.tsx` (**not** `DashboardTab.tsx` — see Section B); the shared components `OptionsDisclosure.tsx`, `DismissOpenDisclosures.tsx`, and `AssigneeAvatar.tsx` (extracted to `components/workspace/` once a second screen needed them); and the light/dark structural tokens in `client/app/globals.css` that both worlds share (`--canvas`, `--surface-1..4`, `--line`, `--line-strong`, `--ink`, `--ink-muted`, `--ink-faint`, `--accent-attention`, `--accent-blocked`).

### Overview

Home rejects the dashboard-of-widget-cards arrangement. It reads as a single calm task list, not an operational console: quiet header, one dominant task list, a secondary two-column band below a single hairline rule. The explicit anti-reference remains the old dark-HUD register (dense bordered panels, mono-uppercase labels, colored pill badges) that the user rejected as generic AI-SaaS.

This is now a **round-2 refinement**, not a reopening of round-1's rules. Round 1 shipped a version the user found "too far toward minimalism... empty, lacking personality, hierarchy, and useful visual structure." Round 2 adds back structure (grouped task sections, an at-a-glance status line, a third content column) and one deliberate surface of depth (the My Tasks panel), while every round-1 rule below — Inter-only, orange restricted to three uses, no pill-status-badges, `ink-muted` not `ink-faint`, spacing-not-borders as the default separator — still holds unchanged. Round 2 did not relax any round-1 rule; it added exactly one new, named exception on top of the existing set (see Elevation & Depth).

My Tasks carries the same vocabulary into a denser, "structured but calm" utility view rather than repeating Home's sparser greeting-page composition: a quiet stat line ("8 tasks · 1 overdue · 0 due today"), smart-grouped sections with counts, and a compact toolbar built from native `<details>` disclosures and checkbox-style toggle links instead of Section B's always-visible pill row. It's still the same world — no mono, no pill badges, no card borders — just more content and hierarchy per screen, matching a task-management workspace's actual density needs.

Workspace Lists joined this world in a third pass, for the same reason My Tasks did: the Lists browsing page and a List's own tabs (Overview/List/Board/Calendar/Timeline/Files) carried Section B's bordered-toolbar, mono-pill-badge clutter the user explicitly flagged as "half-cooked." The browsing page now reuses My Tasks' `OptionsDisclosure`/`FilterToggleLink` pattern for its Status/Member/Starred filters instead of a bordered form with an explicit Apply button, and both this page and the List detail shell gained the `60px` header + `GlobalHeaderActions` row every other calm-world screen already had (the browsing page previously had no header at all). A List's own status (On Track/On Hold/Completed/Dropped) is plain text (`ListStatusControl.tsx`) rather than a colored pill. `SectionList.tsx` (the List tab) keeps its engineered fixed-column row grid — that's load-bearing layout, not decoration — but drops the bordered Section "cards," the mono pill badges for Label/Priority/Status, and the non-functional filter-pill stubs the old version shipped as unwired scaffolding. Because the grid's columns don't reflow at narrow widths yet, the row grid sits in its own `overflow-x-auto` track with a `min-w-[600px]` floor — a disclosed, scoped-down twin of Home's own documented mobile trade-off, not a regression unique to Lists.

Board/Calendar/Files for a List reuse the exact same destyling My Tasks' versions already went through (no mono, plain-text meta, `AssigneeAvatar` over `MemberAvatar`); Timeline (a List-only tab — My Tasks has no Gantt view) only needed empty-state and control-radius touch-ups, since its Gantt grid was already Inter-only going in.

**Key Characteristics:**
- One type family (Inter) end to end — no monospace anywhere in this scope, even though `--font-mono-label` is still loaded globally by `AppShell.tsx` for old-world consumers.
- Brand orange appears in exactly three places: the primary action (including My Tasks' Quick-Add plus icon), the active-nav indicator, and the current-workspace row in the switcher. Nowhere else — including the new at-a-glance summary lines on both Home and My Tasks, which use `ink`/`--accent-attention` instead.
- Status is plain colored text, never a pill/badge — including both at-a-glance summary lines.
- No card borders/surfaces as the default content separator; sections are grouped by spacing and a plain heading — except the one named panel exception on Home (see Elevation & Depth).
- Clear primary/secondary hierarchy: on Home, "My Tasks" is the one elevated, filled surface on the page and dominates a three-column top row, with "Recent Activity" riding alongside it flat and "Recent Lists"/"Assigned to Others" subordinate below a hairline rule; on My Tasks itself, smart sections (Overdue/Blocked/Today/Upcoming/No due date) carry that same dominant/subordinate relationship via color and position, not size.

### Colors

Structural tokens (`canvas`, `surface-1..4`, `line`, `line-strong`, `ink`, `ink-muted`, `ink-faint`) are shared with the old world and theme-aware; round 1 rebalanced the **light** theme to true neutral gray (R=G=B — e.g. `surface-1-light` `#F5F5F5`, `line-light` `#DADADA`, `ink-light` `#16130F`), replacing an earlier light pass that had drifted warm/cream. Dark-theme values are unchanged from the pre-existing operational theme. Round 2 introduces no new color tokens; it reuses `surface-2` and `surface-3` for the new panel (see Elevation & Depth) and `--accent-attention` for the new at-a-glance line's overdue count.

#### Primary
- **Brand Orange** (`#FF6B4A`, constant across themes): the primary action, the sidebar active-nav accent bar, and the current-workspace-selection row in the switcher dropdown. Nothing else in this scope uses it — no badges, no decoration, no links, and not the new at-a-glance counts (those use `ink` or `--accent-attention`, never raw orange).

#### Neutral
- **Canvas** (`#ECECEC` light / `#080808` dark): page background.
- **Surface 1–4**: layered UI surfaces (header bar, row hover, dropdown, the My Tasks panel, etc.), lightest-to-darkest-contrast progression.
- **Line / Line Strong**: hairlines — the header-bottom border, the sidebar-vs-canvas seam, the single rule between the primary and secondary band, dropdown borders.
- **Ink / Ink Muted / Ink Faint**: text hierarchy. `ink` for primary text, row titles, and emphasized at-a-glance counts; `ink-muted` for all secondary/informational text (due dates, item counts, section labels, group subheadings, activity timestamps, empty states).

#### Status
- **Accent Attention** (`#9A3412` light / `#FF6B4A` dark, theme-aware token `--accent-attention`): the one shared "overdue" status signal across Home and My Tasks, applied to text only — the per-row due-date text and both pages' at-a-glance lines. Introduced specifically because raw brand orange fails body-text contrast on the rebalanced light canvas — a deliberate departure from the "brand orange is constant across themes" rule, scoped to this one semantic use.
- **Accent Blocked** (`#8A5A00` light / `#F5B642` dark, theme-aware token `--accent-blocked`): the second and, so far, last color-bearing status signal — "blocked" — added when My Tasks joined this world, since its rows need a Blocked state distinct from Overdue. Same rationale as Accent Attention: the legacy world's amber pill color fails plain-text contrast on the light canvas, so this is its own theme-aware token rather than a reused literal.

### Named Rules
**The Three Uses Rule.** Brand orange appears in exactly three places across this scope: the primary action (Home's capture entry points, My Tasks' Quick-Add), the active-nav indicator, and the current-workspace row in the switcher. If a new element wants orange, it is not one of these three and should not get it — both pages' at-a-glance lines are confirmed examples of something that wanted a splash of color and did not get raw orange.

**The No-Pill-Status Rule.** Status (overdue, blocked, due, complete) is communicated by plain colored/weighted text (`DueDateText`/`dueDateStatus()`/`AttentionGlance` in `HomeWidgets.tsx`; `rowStatus()`/`myTaskRowBadge()` in `MyTasksList.tsx`), never a colored-background pill or badge. This is a direct rejection of the old world's `StatusBadge` pattern for this scope — both pages' at-a-glance lines are plain text with inline emphasis, not a pill, chip, or stat-card. My Tasks additionally keeps Complete and "no due date" rows silent (no status text at all) — the checkbox fill already tells the first story, and an absent date is its own quiet signal rather than a label worth printing on every row.

**The Ink-Muted-Not-Faint Rule.** Secondary/informational text (due dates, counts, labels, group subheadings, activity timestamps, empty states) uses `--ink-muted`. `--ink-faint` fails WCAG body-text contrast (~2.9:1) against `--canvas` in the light theme and must not be used for informational text — in this scope or, going forward, anywhere in the app.

### Typography

**Body/UI Font:** Inter (via the app's Geist Sans `next/font` stack) — no fallback to a second family anywhere in this scope, including every element added in round 2.

**Character:** One quiet, legible sans voice; weight and size carry hierarchy instead of a second typeface or case transform.

#### Hierarchy
- **Page Title** (600, 24px, tight tracking): the greeting line ("Good morning, Name") on Home. My Tasks deliberately has no equivalent in its body — it's a utility view, not a greeting page, so its `<h1>` lives small (600, 13px) in the 60px header bar instead, the way a toolbar app names itself ("My Tasks") rather than re-announcing itself mid-page.
- **Primary Section Heading** (600, 16px): "My Tasks" on Home — the dominant heading on that page, now set inside the elevated panel.
- **Secondary Section Heading** (500, 12px, uppercase, `ink-muted`): "Recent Lists"/"Assigned to Others"/"Recent Activity" on Home; My Tasks' smart-section headers (Overdue/Blocked/Today/Upcoming/No due date) reuse this same voice, each with its own item count appended in the same weight.
- **Group Subheading** (600, 11px, uppercase, `tracking-wide`, `ink-muted`): the Overdue/Blocked/Today/Upcoming/No-due-date labels grouping rows inside Home's My Tasks panel. One size step below Secondary Section Heading so it reads as a sub-grouping, not a sibling section.
- **Row Body** (400, 14px): task titles, list names, activity descriptions — shared verbatim between Home's preview rows and My Tasks' full rows.
- **Meta/Status** (400, 12–12.5px, `ink-muted`, `accent-attention`, or `accent-blocked`): due dates, item counts, workspace labels, "View all" links, both pages' at-a-glance lines, activity relative-time stamps.

### Layout

Home is a centered `max-w-6xl` column (widened from `max-w-4xl` in round 2 to fit the new third column) inside a full-bleed canvas, with page gutters `px-5` at the base breakpoint widening to `px-10` at `sm:` and up — narrowed at the base breakpoint specifically after a mobile capture showed title truncation, not a general density change. Header remains a quiet `60px`.

The page now has two distinct bands:
- **Top row** (`grid-cols-1 md:grid-cols-3`, stacking to one column below `md`): the My Tasks panel at `md:col-span-2`, with Recent Activity as the third column. Recent Activity's top padding (`pt-4 sm:pt-6 md:pt-7`) is matched to the My Tasks panel's own padding (`p-4 sm:p-6 md:p-7`) so the two headings share a baseline despite one sitting inside a filled panel and the other flat.
- **Secondary band**: a two-column grid below a hairline rule, now responsive (`grid-cols-1 sm:grid-cols-2`, was an unprefixed `grid-cols-2`) so Recent Lists and Assigned to Others stack on narrow viewports instead of compressing.

Vertical rhythm: `mb-10` under the greeting, `mt-14` before the secondary band, `pt-10`/`gap-y-10` around the hairline rule, `gap-10` between the top-row columns.

**Known, disclosed trade-off:** on the narrowest supported viewport (390px), the two or three longest demo task titles still truncate inside the My Tasks panel's row layout. This was improved (panel padding tuned, outer gutter narrowed at the base breakpoint) but not fully solved — a full fix would require restructuring the Task Row's checkbox/title/date-label layout, which the second finish-review round judged disproportionate to the severity and deliberately deferred rather than pursuing a third round. Do not read this as resolved; do not re-attempt it opportunistically as a side effect of unrelated work without a deliberate decision to do so.

My Tasks uses a wider `max-w-6xl` column at the same `px-10`/`60px` header rhythm — its toolbar (Workspace/Sort/Group disclosures, Completed/Archived toggles, search) and five-tab nav (List/Board/Calendar/Files/Dashboard) need more horizontal room than Home's single narrow column, and a task-management workspace is expected to carry more on screen than a greeting page. On narrow viewports each row wraps to two lines (title+checkbox on the first, workspace/priority/status/share on a second, indented to align under the title) rather than truncating the title down to nothing.

Both Lists pages (browsing and List detail) use the same `max-w-6xl`/`px-10`/`60px` rhythm as My Tasks, for the same reason — a filterable list of Lists and an eight-tab List workspace both need the room. The Lists browsing page previously rendered with no `60px` header/`GlobalHeaderActions` row at all (a gap unique to that page, not a deliberate Section B trait); it now has one like every other calm-world screen.

### Elevation & Depth

Flat by default, with exactly one named exception added in round 2. No shadows and no card borders as a content separator for most of this scope. A visible surface/border is reserved for three cases:

1. The sidebar-vs-canvas seam (`border-line`).
2. True overlays (the workspace-switcher dropdown, the search palette), which get a border plus a soft `shadow-md`.
3. **New in round 2 — the My Tasks panel**, the single elevated, filled surface in the content column (`rounded-2xl bg-surface-2 p-4 shadow-sm sm:p-6 md:p-7`).

### Named Rules
**The Spacing-Not-Borders Rule.** Content sections (Home's My Tasks panel's exterior framing aside — see the One Panel Rule — plus Recent Activity/Recent Lists/Assigned to Others; My Tasks' and Lists' own smart/grouped sections and toolbars) are separated by spacing and a plain heading, never a bordered/elevated card, as the default. The only borders inside a content column are: on Home, the single hairline rule between the primary and secondary band; on My Tasks and List Board, the hairline under Quick-Add/the toolbar and the Board tab's column lanes; on a List's Calendar and Timeline tabs, the month/day grid lines — a kanban board's columns and a calendar's or Gantt's grid cells are structural data layout, not a "card" default, the same carve-out in both places.

**The One Panel Rule.** Exactly one elevated/filled surface is permitted in Home's content column, reserved for the single most important primary content region — currently the My Tasks panel. Recent Activity, Recent Lists, and Assigned to Others stay flat/unbordered by design, not by oversight: a future pass must not read "no stated rule against it" as license to add a second panel for any of them. If a future surface genuinely earns equal primacy, that requires a deliberate decision to retire or demote the existing panel, not an additive second one. My Tasks has no panel of its own — its density comes from grouped sections and a toolbar, not an elevated container.

### Shapes

Controls use a modest `6px` radius (buttons, hover rows, dropdown, disclosure menus). Home's My Tasks panel uses a larger `16px` radius (`rounded-2xl`), visually distinct from and more generous than the `6px` control radius — proportionate to its role as the one large elevated surface rather than a small interactive control. Avatars and status dots are fully circular. No pill-shaped chrome in this scope (contrast with the old world's badge pills) — including My Tasks' Workspace/Sort/Group pickers and Completed/Archived toggles, which read as plain disclosures and checkbox-style links rather than the chip row this scope replaced there.

### Components

#### Sidebar Navigation
- **Active state:** a quiet 2px inset-left orange accent bar (`shadow-[inset_2px_0_0_0_#ff6b4a]`) plus the primitive's existing font-weight bump. The shared sidebar primitive's own neutral `data-active` background fill is explicitly suppressed (`data-active:bg-transparent`) — this is not a tinted pill.
- **Group labels:** small uppercase Inter, not mono.
- **Workspace switcher:** a bordered, shadowed dropdown (a legitimate overlay); the current-workspace row is the one place besides the active-nav bar and the primary action that brand orange appears (`#ff8a70` tint on the row text).

#### Header Icon Buttons
- 8×8 (`h-8 w-8`) square buttons, `6px` radius, `ink-muted` icon at rest, `surface-3` hover background, `ink` hover icon color. Shared by search, theme toggle, and notifications (`GlobalHeaderActions.tsx`, `theme-toggle.tsx`).

#### Task Row (signature component)
A plain unbordered row: a circular checkbox/complete indicator, a truncated title link, and optional trailing status text. On Home, hover state is a `surface-3` background wash inside the My Tasks panel (changed from `surface-2` in round 2 — the old hover color would be invisible once the panel's own background became `surface-2`); the row itself carries no border or shadow. Complete items get a filled orange circle with a check glyph and strikethrough/muted title text. Home's rows group under small uppercase Group Subheadings by smart-section key (Overdue/Blocked/Today/Upcoming/No due date) — only sections with items render; see the Layout section's disclosed mobile-truncation trade-off for this component's known limit. My Tasks' full-page variant (`MyTasksList.tsx`) extends the same row with a muted source-List/Workspace label, a High-priority dot+label (Normal/Low stay silent — only the exception needs flagging), and a share-link icon button that stays hidden until the row is hovered or focused (`opacity-0 sm:group-hover:opacity-100`) — always visible below the `sm` breakpoint, since touch has no hover state to reveal it with.

#### My Tasks Panel (signature component, Home only)
The one elevated surface permitted in Home's content column (see Named Rules above): `rounded-2xl bg-surface-2 p-4 shadow-sm sm:p-6 md:p-7`. Contains the "My Tasks" heading, the `AttentionGlance` at-a-glance line, and the grouped Task Rows. `AttentionGlance` renders only non-zero Overdue/Blocked/Today counts as plain text (e.g. "1 overdue · 1 blocked") — the overdue number colored via `--accent-attention`, everything else `ink`/`font-semibold` — with no pill or badge, consistent with the No-Pill-Status Rule.

#### Recent Activity Widget (Home only)
Flat, no surface — consistent with the Spacing-Not-Borders default and the One Panel Rule. Renders an actor-driven activity description (via the existing `describeNotification` lib helper) plus the affected item's title and a relative timestamp ("Just now" / "Nm ago" / "Nh ago" / "Nd ago", falling back to a short date past a week).

#### Options Disclosure (shared — `components/workspace/OptionsDisclosure.tsx`)
A native `<details>`/`<summary>` trigger ("Sort  Smart ⌄") that expands into a small menu of plain-text links — the pattern behind My Tasks' Workspace/Sort/Group/Board-"Group by" pickers and Lists' Status/Member pickers. Zero client JS to open or navigate (every option is a real link); `DismissOpenDisclosures.tsx` (also shared) is the one small Client Component either page needs, closing any open disclosure on an outside click or Escape since native `<details>` has no light-dismiss of its own. This is what replaced Section B's always-visible row of pill buttons for the same controls. Started local to `app/my-tasks/page.tsx`; extracted to `components/workspace/` once Lists' browsing page needed the identical pattern rather than a second copy.

#### Filter Toggle (shared — `FilterToggleLink` in `OptionsDisclosure.tsx`)
A binary filter (My Tasks' Completed/Archived, Lists' Starred) renders as a checkbox-styled link (a small square, filled + checked when active) rather than joining the Options Disclosure pattern above — it's a switch, not a pick-one-of-several list, so it gets its own distinct but consistent affordance.

#### List Status Control (List detail only — `ListStatusControl.tsx`)
A List's lifecycle status (On Track/On Hold/Completed/Dropped) renders as plain text, never a colored pill (the component it replaced, `ListStatusPill.tsx`, is gone). A Lead/Admin gets a borderless native `<select>` styled to read as plain text that submits on change; anyone else sees the same text read-only. No color-coding by status value — there's no established accent mapping for List lifecycle the way Overdue/Blocked have one for Items, so every status prints in `ink-muted`.

#### List Row (Lists browsing page)
A plain unbordered row — star toggle (a real `lucide-react` `Star` icon, filled when starred, not the old Unicode "★" glyph), name + description, status and member-count as plain `ink-muted` text, and an Archive/Restore action revealed on hover (`opacity-0 sm:group-hover:opacity-100`, always visible below `sm` since touch has no hover) — the same reveal-on-hover convention as My Tasks' row-level share-link button.

### Do's and Don'ts

#### Do:
- **Do** keep this scope single-family Inter; don't introduce `--font-mono-label` here even though it's loaded for other screens.
- **Do** use `--ink-muted` for all secondary/informational text; never `--ink-faint`.
- **Do** separate content sections with spacing and a plain heading by default, not a card border.
- **Do** keep brand orange to the three named uses.
- **Do** treat the My Tasks panel as the one permitted elevated surface in the content column; match any new primary-region surface's padding/heading baseline to it the way Recent Activity's `pt-*` matches the panel's `p-*`, rather than inventing a second independent surface.

#### Don't:
- **Don't** add a colored-background status pill/badge to Home, the shell, or My Tasks — status is text color only, including any at-a-glance or summary line.
- **Don't** add a bordered or filled card around a content section as the default container.
- **Don't** add a second elevated/filled panel on Home (e.g. around Recent Activity, Recent Lists, or Assigned to Others) — the One Panel Rule reserves that treatment for a single primary content region.
- **Don't** reuse `components/workspace/StatusBadge.tsx` or `components/workspace/MemberAvatar.tsx` in this scope — they carry the old world's mono-label styling; `components/workspace/AssigneeAvatar.tsx` is this scope's shared Inter-set stand-in (originally local to `HomeWidgets.tsx`, extracted once Lists' `SectionList.tsx`/`RolesColumn` needed the same thing), and My Tasks' rows don't show a per-row avatar at all (every row is implicitly "assigned to me" already, so repeating the viewer's own avatar on every row added nothing worth the space).
- **Don't** bring My Tasks' or a List's own Dashboard tab into this scope's rules — both stay Section B's widget-card idiom deliberately (see Section B) until `DashboardWidgets.tsx`, which they share, gets its own redesign pass.
- **Don't** treat the current mobile title-truncation behavior in Home's My Tasks panel as fully solved — it is a disclosed, deliberately deferred trade-off, not a canonized acceptable state for future Task Row work to build on without reconsidering the row layout.

---

## B. The Legacy Operational World (unchanged) — everywhere else

**Scope:** `app/updates`, `app/workspaces/[workspaceId]/lists/[listId]/items/**` (the Item detail page and its `@drawer` parallel slot — not yet redesigned even though the List pages around it now are), `app/workspaces/[workspaceId]/settings`, `app/settings/**`, `app/profile`, `app/users/**`, the pre-auth funnel (sign-in/up, password reset, email verification, invitations), My Tasks' and a List's own `DashboardView.tsx`/`DashboardTab.tsx` tabs (and the `DashboardWidgets.tsx` they both share — out of this redesign's scope since changing it would move both Dashboards, not just one), and shared components `StatusBadge.tsx`, `MemberAvatar.tsx`, and any other consumer of `--font-mono-label`. `ListStatusPill.tsx` is gone — replaced by Section A's `ListStatusControl.tsx` now that Lists moved. This section is preserved from the prior DESIGN.md; it was not re-verified against the build in this pass beyond confirming these files still exist and still use it.

Source reference: `sample.html`. The operational app shell previously described as the whole app's default ("Nexus Protocol" derived) is now accurate only for this scope.

### Overview

A focused, dark operational workspace style: structured, fast, serious without being heavy. Emphasizes immediate capture, scannable lists, compact navigation groups, subtle borders, ambient motion, clear hierarchy. Supports a light theme via a user-facing toggle (ADR 0014); dark is the default. The pre-authentication funnel renders dark only.

### Colors

Primary `#FF6B4A`, secondary `#333333`, accent `#FF8A70`, an original background of `#E5E5E0` (light-theme first pass — note the structural light tokens this screen family draws on, `--canvas`/`--surface-*`/`--line`/`--ink`, were rebalanced to true neutral gray in the round-1 pass per Section A; this legacy scope inherits that rebalance since it's the same CSS variables, even though its component-level patterns were not touched). Status badges use a fixed four-tone palette: red `#f2545b`, amber `#f5b642`, blue `#5b9dff`, green `#3ecf8e`, each at `~14%` background opacity with full-opacity text (`StatusBadge.tsx`).

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
- My Tasks' `DashboardView.tsx` and a List's `DashboardTab.tsx` both still have `--font-mono-label` usage after this pass. That's an intentional scope boundary, not a miss: both Dashboard tabs were left in Section B on purpose (see Section B's scope note), not partially migrated — redesigning one without the other isn't possible anyway since they share `DashboardWidgets.tsx`.
- The My Tasks panel's mobile title truncation at 390px (two or three longest demo titles) is a disclosed, deliberately deferred defect of the Task Row's current layout, not a target to fix opportunistically and not a precedent for accepting truncation elsewhere in Section A.
- `SectionList.tsx`'s row grid (List tab) has the same kind of narrow-viewport limit as the My Tasks panel, but scoped down rather than fixed: the grid doesn't reflow at narrow widths, so it scrolls horizontally inside its own `overflow-x-auto` track instead of truncating or breaking. Not a target to "finish" into a reflowing layout as a side effect of unrelated work — that would be the Task Row's two-line-wrap treatment, a deliberate redesign decision this pass didn't make for List's denser multi-column row.
- `app/workspaces/[workspaceId]/lists/[listId]/items/**` (the Item detail page/drawer) is still Section B, unmigrated, even though both pages that link into it (Lists browsing and the List detail tabs) are now Section A. A user can navigate from a calm-world row straight into the old dark-HUD Item detail view — a known seam at this pass's scope boundary, not an oversight to silently patch over.
