# Grill Session: Global Search (Command Palette)

## Context

Resolving [issue #56](https://github.com/codesuke/ListItUp/issues/56) (`wayfinder:grilling`): the header's Search button is a stub (`title="Search — coming soon"` in `GlobalHeaderActions.tsx`). Needed to settle what's searchable, permission filtering, query mechanism, and UI shape.

Research going in: `lib/list/list-browsing.ts#browseLists` and My Tasks (`app/my-tasks/page-data.ts`) already search via Prisma `contains`/`insensitive` (Postgres ILIKE) — no full-text search infrastructure exists anywhere in the schema. `lib/permissions/list-access.ts` resolves access per-List; `browseLists` instead does its own set-based visibility filter (`OR: [{members: some}, {guests: some}]`, bypassed for Owner/Admin) for bulk queries. `GlobalHeaderActions` renders only inside `app/workspaces/[workspaceId]/layout.tsx`, which `notFound()`s unless the User has a `WorkspaceMember` row — so Guests (who have no Workspace-level identity per `CONTEXT.md`) never reach global search. No `Dialog`/`Command` primitive exists in `components/ui/` yet. `/profile` only ever renders `session.user.id` — there is no route to view another User's profile.

## Questions

### 1. What entity types does v1 global Search cover?

**Recommended answer**:

Items + Lists, no Members — a List is a first-class destination (same reason Lists browsing already has its own name search), but Members have no dedicated work surface to land on (Profile carries no work widgets per `CONTEXT.md`).

**User answer**:

Add Members too.

**Settled outcome**:

v1 searches **Lists, Items, and Members** together.

### 2. Does search span the current Workspace only, or every Workspace the User belongs to?

**Recommended answer**:

Current Workspace only (including Personal Space when that's current) — matches `browseLists`/Lists-browsing precedent, and avoids cross-tenant leakage risk from a casual header search box.

**User answer**:

Agreed.

**Settled outcome**:

Search is scoped to the **current Workspace only** (the Workspace `AppShell` is already rendering for).

### 3. Query mechanism: Postgres ILIKE vs full-text search?

**Recommended answer**:

ILIKE (`contains`, `mode: "insensitive"`), matching the two existing search features exactly. No proven need yet for ranking/stemming/typo-tolerance, and introducing a second mechanism alongside the one already used twice would be inconsistent.

**User answer**:

Agreed.

**Settled outcome**:

Search matching uses Prisma `contains` / `mode: "insensitive"` (Postgres ILIKE) — no full-text search.

### 4. UI shape: command palette vs dedicated results page?

**Recommended answer**:

Dedicated results page (`/search?q=...`), reusing the `searchParams`-driven Server Component pattern already proven in Lists browsing and My Tasks — no new primitives or client-heavy live-query infra needed.

**User answer**:

Command palette sounds better.

**Settled outcome**:

v1 ships as a **command palette** (modal, opened from the header), not a results page. This requires a new shadcn `Dialog`/`Command` primitive and a client-side query path that doesn't exist in this app yet.

### 5. Live-as-you-type, or type + submit?

**Recommended answer**:

Live-as-you-type, debounced (~200ms), backed by a `GET` Route Handler returning JSON — command palettes are expected to filter live, and `docs/agents/nextjs-conventions.md`'s Route Handler carve-out explicitly allows this ("a specific interactivity reason").

**User answer**:

Agreed.

**Settled outcome**:

The palette queries **live as you type**, debounced ~200ms, against a new `GET /api/search` Route Handler.

### 6. Keyboard shortcut to open the palette?

**Recommended answer**:

`Cmd+K` / `Ctrl+K`, the standard convention for this UI pattern (Linear, Raycast, GitHub, VS Code), in addition to clicking the header Search button.

**User answer**:

Agreed.

**Settled outcome**:

`Cmd+K` / `Ctrl+K` opens the same palette as the header Search button.

### 7. What happens when a Member result is selected?

**Recommended answer**:

Navigate to the Lists-browsing page filtered by `?member=<userId>` (reusing `browseLists`' existing `memberUserId` filter) rather than a Profile page with no work content.

**User answer**:

Their profile anyway — a "coming soon" page for now, which should get automatically updated afterwards.

**Settled outcome**:

Selecting a Member result navigates to a new standalone route, **`/users/[userId]`** (outside the Workspace shell, same standalone pattern as `/profile` — no sidebar). It renders a minimal "Profile — coming soon" placeholder today (at least the target User's name/avatar). When a real cross-User profile feature is built later, it fills in this same route — the search link's destination never has to change.

### 8. Are archived Lists/Items included in results by default?

**Recommended answer**:

Excluded by default, matching `browseLists` (archived only shown under its explicit "Archived" tab) and `CONTEXT.md`'s framing of Archive as removal from active use. No archived toggle in the palette for v1.

**User answer**:

Agreed.

**Settled outcome**:

Archived Lists and Items are **excluded** from search results. No in-palette toggle for v1.

### 9. Result grouping, ordering, and caps per category?

**Recommended answer**:

Three labeled sections — Lists, Items, Members — capped at 5 each, ordered `updatedAt desc` for Lists/Items (matching `browseLists`' existing order) and `name asc` for Members. Matching on title/name only (Item has no `description` field in the schema; `List.name`/User `name` are the only free-text fields existing precedent already searches).

**User answer**:

Agreed.

**Settled outcome**:

Results render as three sections — **Lists**, **Items**, **Members** — each capped at **5**, ordered `updatedAt desc` (Lists/Items) / `name asc` (Members). Matching is on `List.name`, `Item.title`, and `User.name` only — no Notes-body search in v1.

### 10. What is the settled permission model?

**Recommended answer**: _(stated as a confirmation of what the prior answers already imply, not a fresh fork)_

Search only ever runs for Workspace Owner/Admin/Member/Viewer, since `GlobalHeaderActions` is unreachable without a `WorkspaceMember` row (Guests never reach it). Owner/Admin see every List and its Items in the Workspace; everyone else sees only Lists they're an explicit `ListMember` of, and only those Lists' Items — identical to `browseLists`' visibility rule. Member search returns the full Workspace roster to any searcher (no List-scoping), matching the existing unrestricted member-list precedent already used for the Lists-browsing filter dropdown.

**User answer**:

Agreed.

**Settled outcome**:

Permission filtering reuses `browseLists`' visibility rule verbatim for Lists/Items (Owner/Admin: all; everyone else: `ListMember`-only). Member search is unrestricted within the Workspace roster, matching existing precedent. Guests are out of scope by construction.

## Date

2026-10-02

## Follow-Ups

- Glossary updates: none — no new domain terms; Search is a feature, not new product language.
- ADRs created: `docs/ADR/0015-command-palette-global-search.md` (command-palette architecture + new Route Handler + cross-entity ILIKE search as the durable, hard-to-reverse choice).
- Specs affected: none pre-existing; implementation tracked via a new GitHub issue (see issue #56's closing comment for the link) rather than a `docs/Specs-Planned/` doc, since the QnA session above is the full spec for this reasonably small vertical slice.
