# Command Palette for Global Search

`docs/QnA/global-search-command-palette.md` (resolving [issue #56](https://github.com/codesuke/ListItUp/issues/56)) settled the header Search button's design as a `Cmd+K`/`Ctrl+K` command palette with live-as-you-type results, rather than a dedicated `/search?q=...` results page. Every other data-browsing surface in `client/` (Lists browsing, My Tasks) is a server-rendered page driven by `searchParams`; this is the first feature to introduce a client-side live-query UI, a `GET /api/search` Route Handler, and a new shadcn `Dialog`/`Command` primitive.

## Status

accepted

## Considered Options

- Dedicated results page (`/search?q=...`): reuses the existing `searchParams`-driven Server Component pattern exactly, no new primitives or client query path. Rejected because the product call (grilling session) preferred the faster, keyboard-driven jump-to pattern a palette gives over a full page navigation per search.
- Command palette with live-as-you-type via a new `GET /api/search` Route Handler: matches the UX convention users expect from this pattern (Linear, Raycast, GitHub, VS Code). Chosen.

## Consequences

- `GET /api/search` is a Route Handler that exists purely to serve this app's own client, not an external consumer — a deliberate, narrow exception to `docs/agents/nextjs-conventions.md`'s general "Route Handlers are for external consumers only" guidance, justified by the explicit interactivity carve-out it already states (debounced client-side querying has no Server Action equivalent).
- A new shadcn `Dialog`/`Command` primitive is added to `components/ui/` (regenerated via the `shadcn` CLI, not hand-rolled) — the first modal primitive in this app. Future modal UI should reuse it rather than hand-rolling another one.
- The Route Handler must re-derive the same visibility filter `lib/list/list-browsing.ts#browseLists` already uses (Owner/Admin see all; everyone else only their `ListMember` Lists) rather than re-deriving a different or looser rule — any future entity type added to search must decide its own visibility rule explicitly rather than assume the Lists/Items one applies.
- Selecting a Member result lands on `/users/[userId]`, a new standalone route outside the Workspace shell (mirroring `/profile`'s pattern) that only renders a "coming soon" placeholder today. A future cross-User profile feature should fill in this same route rather than introducing a different URL, so the search palette's link target never needs to change.
