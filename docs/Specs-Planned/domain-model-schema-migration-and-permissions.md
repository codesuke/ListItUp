# Domain Model, Schema Migration & Permissions

## Problem Statement

ListItUp's product model was redefined by the wayfinder grilling process (`Workspace -> List -> Item`, two-tier roles plus List-scoped Guests — ADR 0008, ADR 0009), but `client/prisma/schema.prisma` and `client/lib/workspace/` still reflect the discarded pre-redefinition model: a `Workspace` can have only one `ownerId`, `WorkspaceMember` carries a flat `role` string with no List-level tier, `List` is a bare `{ workspaceId, name, isInbox }` row, and no `Item` model exists at all. Every later feature — List browsing, Item CRUD, Home, My Tasks, Reports — needs a schema that can represent Workspace/List/Guest roles and Items, and needs one consistent place that resolves "can this User do X to this List/Item," because ADR 0009 requires that resolution to be enforced server-side and identically everywhere, not re-implemented ad hoc per feature.

Without this foundation, any feature spec built on top of it would either block on an undefined schema or invent its own permission checks that later drift from ADR 0009's resolution order.

## Solution

Migrate the schema to the settled domain model and build a single `lib/permissions/` module that resolves a User's effective access to a Workspace, List, or Item. This spec ships no user-facing page — it is the data-layer and authorization foundation the List & Item Core spec builds on.

Scope: the Workspace/List/Item schema skeleton (enough fields for later specs to add behavior without further migrations to core tables), the Workspace and List role models, Guest grants, Personal Space representation, and the effective-access resolution function. Feature-specific behavior (List views, Item editing UI, Reports) is out of scope here and belongs to later specs.

## User Stories

1. As a developer building any later feature, I want one Prisma schema that already represents Workspace roles, List roles, Guests, and Items, so that I do not design ad hoc tables per feature.
2. As a developer, I want one `lib/permissions/` function to call for "can this User do X here," so that authorization logic is not duplicated or inconsistently reimplemented across List, Item, Home, and Reports.
3. As a Workspace Owner, I want to remain the sole Owner of my Workspace with implicit access to every List including private ones, so that I always retain ultimate control.
4. As a Workspace Owner, I want ownership transfer to be an explicit, atomic action, so that a Workspace is never left without exactly one Owner.
5. As a Workspace Admin, I want no implicit access to Lists I'm not in — they're invisible to me until a Lead or the Owner adds me — while keeping the ability to create Lists (becoming their first Lead) and manage Workspace members, so that private Lists stay private and my Workspace-level job is unaffected. (Amended: supersedes implicit List access for Admin per ADR 0017, `docs/Specs-Planned/list-lead-rules.md`.)
6. As a Workspace Member, I want no List access by default and no ability to create Lists, so that shared Workspaces start private-by-default per List.
7. As a Workspace Member added to a specific List, I want my List-level role (Lead/Member/Viewer) to determine what I can do in that List, so that access is granted List by List.
8. As a Workspace Viewer, I want my access to stay read-only everywhere in the Workspace even if I am given a higher List-level role, so that Viewer is a hard ceiling and not a starting point.
9. As a List Lead, I want to manage that List's settings, its List-level membership, and its Guests, so that I can administer one List without needing Workspace Admin rights.
10. As a List Member, I want to create and edit Items within my assigned List, so that I can do the work without needing List Lead rights.
11. As a List Viewer, I want to read a List's Items without being able to change them, so that I can stay informed without editing rights.
12. As a person given Guest access to a List, I want read-only access to that List's Items without joining the Workspace or seeing anything outside the List(s) I was explicitly granted, so that external collaborators stay scoped to exactly what they were given.
13. As a List Lead (or the Workspace Owner, via implicit Lead-equivalent access), I want to grant or revoke a Guest's access to a specific List directly, so that external access is controlled at the point closest to the data. (Amended: a Workspace Admin without explicit List access has no standing here per ADR 0017 — they grant Guest access only on Lists they've been added to, like any List Lead.)
14. As a User, I want my Personal Space to exist automatically after my first verified sign-in and to be present regardless of which Workspace I have open, so that I always have somewhere to keep private Lists.
15. As a User, I want my Personal Space's Lists and Items to behave with the same capabilities as a shared Workspace's, so that personal and team use of ListItUp feel consistent.
16. As a User, I want my Personal Space to never appear as an entry in the Workspace switcher, so that it is not confused with a shared Workspace (per issue #13's settled nav model, built on in a later spec).
17. As a developer, I want an `Item` schema that supports nested child Items of arbitrary depth through one mechanism, so that there is no separate `Subtask` concept to keep in sync.
18. As a developer, I want an `Item` schema that already has fields for Assignees (zero or more), an immutable Creator, a five-state lifecycle, Priority, and a Blocker reason, so that the List & Item Core spec can implement behavior against a stable shape.
19. As a developer, I want `Label`, `Custom Field` definition/value, `Dependency`, `Attachment`, `Note`, and `Personal Note` tables to exist as part of this migration, so that later specs add behavior and UI, not new core tables.
20. As a developer, I want List-level fields for Description, Status, and per-User Starred to exist in the schema, so that the List & Item Core spec can build the List browsing page and List header against a stable shape.
21. As a developer, I want the permission resolution order (Workspace Owner implicit Lead-equivalent access, then Workspace Viewer ceiling, then explicit List role, then Guest access, then no access) implemented once and unit-tested against every role combination, so that every later feature's authorization check is provably correct by construction. (Amended: Admin is no longer an implicit-access tier per ADR 0017 — an Admin falls through to their explicit List role, if any, like any other Workspace member.)
22. As a developer, I want `lib/workspace/workspace-provisioning.ts` and `lib/workspace/workspace-invitations.ts` updated to create rows under the new role model (Personal Space provisioning, Workspace role assignment on invite acceptance), so that the auth epic's existing flows keep working against the new schema.
23. As a Workspace Admin inviting a new Member, I want to choose their Workspace-level role at invitation time (Member or Viewer; Admin/Owner are not invite-time grants), so that role assignment happens at the point of invitation rather than as a manual follow-up step.
24. As an operator, I want the migration written with `pnpm exec prisma migrate dev` from `client/`, so that the change is tracked as a reviewable, reproducible migration rather than a hand-edited SQL file.

## Implementation Decisions

- Treat `client/prisma/schema.prisma` as the source of truth; generate the migration with `pnpm exec prisma migrate dev --name <descriptive_name>` from `client/`, never hand-edit `migrations/**/migration.sql`.
- Represent both a shared Workspace and a User's Personal Space with the same underlying container table, discriminated by a `kind` field (`SHARED` / `PERSONAL`). This is an internal modeling choice only — product-facing naming, UI, and the switcher (later spec) must still treat Personal Space as a distinct concept from Workspace per `CONTEXT.md`, never surfacing the shared table name to users. A Personal Space container always has exactly one membership row (its User, implicitly Owner-equivalent) and is created automatically during first-verified-sign-in provisioning.
- Model Workspace-level role as an enum (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) on a per-Workspace membership row, replacing the current single `ownerId` column on `Workspace` and the current flat `role: String` on `WorkspaceMember`. Enforce "exactly one Owner per Workspace" at the application layer inside the same transaction that performs ownership transfer (revoke old Owner's role, grant new Owner's role, atomically); do not rely solely on a database constraint for this invariant.
- Model List-level role as a separate enum (`LEAD`, `MEMBER`, `VIEWER`) on a per-List membership row, distinct from the Workspace-level role. A List membership row may only be created for a User who already holds a Workspace-level membership (Member, Admin, Owner, or Viewer) in that List's Workspace — Guests are the only path to List access without Workspace membership.
- Model Guest access as its own table keyed by User and List (not a List-role enum value), so that "no Workspace-level identity" stays structurally true rather than a naming convention. A Guest row grants read-only access to exactly the List(s) it names.
- Lists are private by default: creating a List does not implicitly grant access to any Workspace Member other than its creator (who becomes its first Lead) and Users with implicit Workspace Owner/Admin access.
- Add `description` (nullable text), `status` (enum: `ON_TRACK`, `ON_HOLD`, `COMPLETED`, `DROPPED`; default `ON_TRACK`) to List. Model `Starred` as a per-User-per-List join row, not a boolean column on List, since it is a per-User flag. Add a `Section` table scoped to one List with a name and an explicit order.
- Add an `Item` table with: a required single parent List, an optional self-referencing parent Item (supporting arbitrary-depth nesting through one mechanism), title, an optional Section reference, an optional due date, a five-value lifecycle state enum (`TO_DO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`, `ARCHIVED`), a Priority enum (`LOW`, `NORMAL`, `HIGH`; default `NORMAL`), an optional Blocker reason text, and an immutable Creator reference set once at creation and never reassigned. Model Assignees as a many-to-many join table between Item and User.
- Add `Label` scoped to one container (Workspace or Personal Space, per the unified table above) with a many-to-many join to Item.
- Add `CustomFieldDefinition` scoped to one List (name, type enum `TEXT`/`NUMBER`/`DROPDOWN`/`DATE`, and dropdown options where applicable) and `CustomFieldValue` scoped to one Item and one definition, unique per (Item, definition) pair.
- Add `Dependency` as a directed edge between two Items (`blocks` / `is blocked by`), allowed across different Lists, with no automatic state changes triggered by it — purely informational per `CONTEXT.md`.
- Add `Attachment` scoped to one Item, storing the object-storage key and metadata per ADR 0002 (S3/MinIO-compatible storage); do not implement upload/download behavior in this spec, only the schema and storage-key shape.
- Add `Note` scoped to one Item with an author and body, and a `Mention` join capturing which Users were `@mentioned` in a Note (validated at write time against Users who already have access to that Note's Item) — this schema exists here so the Updates/notifications spec can build on it without its own migration.
- Add `PersonalNote` as a private, per-User-per-Item row, visible only to its owning User and never surfaced on the shared Item.
- Build `lib/permissions/` as a small module exposing one effective-access resolution function per (User, List) and one per (User, Item, deriving from the Item's List), implementing the order: Workspace Owner/Admin implicit access, then Workspace Viewer ceiling (caps everything below it at read-only), then explicit List-level role, then Guest access, then no access. Every other module's authorization checks call through this function rather than querying membership tables directly.
- Update `lib/workspace/workspace-provisioning.ts` to create a `PERSONAL`-kind container (not a `SHARED` Workspace) plus its Inbox List on first verified sign-in, and `lib/workspace/workspace-invitations.ts` to accept a Workspace-level role (`MEMBER` or `VIEWER`) at invitation time and create the corresponding membership row on acceptance.

## Testing Decisions

- Test `lib/permissions/` as focused unit tests (`lib/permissions/*.test.ts`, run via `tsx`) covering every role combination in the resolution order: Workspace Owner, Workspace Admin, Workspace Member with no List role, Workspace Member with each List role, Workspace Viewer with each List role (asserting the ceiling holds), Guest with and without a matching grant, and a User with no relationship to the Workspace or List at all.
- Test the Personal Space provisioning change as an update to the existing `lib/workspace/workspace-provisioning.test.ts` and its integration test, asserting a `PERSONAL`-kind container and Inbox List are created and that the container is never returned by any "list shared Workspaces" query.
- Test Workspace invitation role assignment as an update to the existing `lib/workspace/workspace-invitation-flow.integration.test.ts`, asserting the invited role becomes the accepted membership's role.
- Test ownership transfer as a `lib/workspace/*.test.ts` (new) covering the atomic swap: old Owner becomes the specified new role (per Implementation Decisions, a transfer target role for the outgoing Owner still needs a default — treat it as `ADMIN` unless a later spec says otherwise), new Owner's role becomes `OWNER`, and a mid-transaction failure leaves the original Owner intact (no zero-Owner or two-Owner intermediate state observable to a reader).
- No Server Component or Server Action tests are needed in this spec since it ships no user-facing route; defer route-level tests to the List & Item Core spec, which is the first to expose this schema through the UI.
- Use the existing integration-test pattern (`*.integration.test.ts` against a real Prisma client via `@prisma/adapter-pg`, skipping gracefully when `DATABASE_URL` is unset) for anything that requires the database to prove a constraint, and plain unit tests for pure resolution logic that needs no database.

## Out of Scope

- Any user-facing page, Server Action wiring to a form, or UI for List/Item/Guest/role management — this spec is schema and a pure permission function only.
- List views, List browsing page, Item editing behavior, Sections management UI, Labels UI, Custom Field UI, Dependency UI, Attachment upload/download, Notes/Mentions UI — all belong to the List & Item Core spec.
- Home, Profile, Updates, My Tasks, Reports, Analytics — belong to their own specs, built on top of this one.
- The v2 Chat/VC system (`Channel`, `Direct Message`) and their ADR 0013 permission exception — explicitly deferred to v2, not part of this migration.
- `Portfolio` and `Goal` — rejected outright (ADR 0010, ADR 0011); no schema for either.
- Public Task Tracking / "Company Position" field (issue #14) and GitHub Integration (issue #15) — still ungrilled, excluded from this spec.

## Further Notes

- This spec must ship before the List & Item Core spec, which builds Server Actions and UI directly on the schema and `lib/permissions/` seam defined here. The Home/Profile/Updates/My Tasks spec and the Reports & Analytics spec both depend transitively on List & Item Core.
- The exact outgoing-Owner target role on ownership transfer (`ADMIN` by default, per Testing Decisions) is a reasonable default inferred from ADR 0009 and was confirmed by the repo owner during implementation of issue #20 (2026-09-14).
- "Items I've Assigned" (used by the Home spec) and any cross-Workspace My Tasks query rely on the Assignee join table and `lib/permissions/` being correct across Workspace boundaries — this spec's tests should include at least one multi-Workspace scenario to de-risk that later dependency.
