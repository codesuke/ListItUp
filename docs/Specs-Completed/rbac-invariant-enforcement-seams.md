# RBAC Invariant Enforcement Seams

## Problem Statement

`resolveListAccess` trusts a `ListMember` row's role even when the User has no `WorkspaceMember` row at all in that Workspace — an orphaned `ListMember` silently grants access. The only existing defense (cleanup-on-exit inside `removeWorkspaceMember`/`leaveWorkspace`) only prevents new orphans at those two mutations, not a bug or data issue anywhere else; a recent data migration on `main` had to repair exactly this kind of damage after the fact. Separately, the never-empty-Lead rule is already correctly enforced at every current mutation that can remove or demote a Lead-bearing row, but this was never formally ratified as THE mechanism, leaving open whether a future change should instead reach for a DB constraint or trigger. Third, 5 call sites (`list-creation.ts`, `list-labels.ts`, `workspace-peer-comparison.ts`, `list-browsing.ts`, `global-search.ts`) each hand-roll their own Workspace-role check instead of calling a shared resolver, and 3 of those 5 don't check for a soft-deleted Workspace at all.

This was settled in the grilling session resolving [issue #86](https://github.com/codesuke/ListItUp/issues/86), recorded in `docs/QnA/rbac-invariant-enforcement-seams.md` and [ADR 0019](../ADR/0019-rbac-invariant-enforcement-seams.md). This spec implements that resolution.

## Solution

Add a defensive check inside `resolveListAccess` so a `ListMember` row never grants access without a live `WorkspaceMember` row backing it, while leaving Guest access (which has no `WorkspaceMember` by design) untouched. Ratify the existing shared-locking-helper pattern as the never-empty-Lead rule's one enforcement mechanism via a doc comment, with no DB-level change. Route the 5 affected call sites through existing or small new shared predicates instead of their own hand-rolled role sets. Add a cross-check test pinning the hand-rolled visibility filters in `browseLists`/`globalSearch` against `resolveListAccess`'s per-row answer.

## User Stories

1. As a developer, I want `resolveListAccess` to disregard a `ListMember` row when the User has no `WorkspaceMember` row in that List's Workspace, so that an orphaned row (from a bug, a bypassed cleanup path, or data predating this fix) can never silently grant access.
2. As a developer, I want a Guest's access to keep resolving normally regardless of whether they hold a `WorkspaceMember` row, so that the fix for story 1 doesn't break the one path that's intentionally Workspace-identity-less.
3. As a developer, I want the existing cleanup-on-exit (`clearWorkspaceListAccess`) to keep running on `removeWorkspaceMember`/`leaveWorkspace`, so that orphaned rows don't accumulate just because they're now harmless.
4. As a developer reading `lib/list/list-membership.ts`, I want a doc comment on `lockAndCountSoleLeadLists`/`lockAndInspectListMember` stating every `ListMember`/`WorkspaceMember` delete or role-demotion must call it first, so that a future mutation doesn't bypass the never-empty-Lead rule by omission.
5. As a developer, I want `list-creation.ts`, `list-labels.ts`, and `workspace-peer-comparison.ts` to call the existing `canManageWorkspace()` instead of re-declaring their own `OWNER`-or-`ADMIN` role set, so that the allowed-role list has one source of truth.
6. As a Workspace Owner or Admin, I want List creation, Label creation, and the Peer Comparison setting to correctly refuse me once my Workspace is soft-deleted, so that a Deleted Workspace is consistently locked down everywhere, not just in the places that happened to already check `deletedAt`.
7. As a developer, I want `list-browsing.ts` and `global-search.ts` to call a shared `hasImplicitListAccess()` predicate instead of each hard-coding `role === "OWNER"`, so that the Owner-sees-every-List rule has one named definition instead of two independent copies.
8. As a developer, I want a test asserting `browseLists`'s and `globalSearch`'s visibility filters agree with `resolveListAccess`'s per-row answer across every role, Guest, and deleted-Workspace combination, so that a future change to one without the other fails CI instead of silently becoming a visibility bug.

## Implementation Decisions

- `resolveListAccess`: before resolving a `ListMember`-based access level, verify the same `{userId, workspaceId}` has a `WorkspaceMember` row. If not, treat the `ListMember` row as absent (fall through to the Guest check, exactly as if no `ListMember` row existed) rather than returning `NONE` outright — a Guest grant on the same List must still resolve. The Owner-implicit-access check and the Viewer ceiling, both already gated on `workspaceMembership`, are unaffected by this change.
- `lib/list/list-membership.ts`: add a doc comment directly above `lockAndCountSoleLeadLists` and `lockAndInspectListMember` stating they must be called, inside the same transaction, before any code deletes a `ListMember`/`WorkspaceMember` row or changes a `ListMemberRole` away from `LEAD`. No new test harness or lint rule — convention and code review, matching this repo's existing enforcement style for comparable invariants.
- `list-creation.ts`, `list-labels.ts`, `workspace-peer-comparison.ts`: replace their local `ROLES_ALLOWED_TO_CREATE_LIST`/`ROLES_ALLOWED_TO_CREATE_LABEL`/`ALLOWED_ROLES` sets with a call to `canManageWorkspace()` from `lib/permissions/workspace-access.ts`. Each call site also fetches the Workspace's `deletedAt` and refuses via the existing `isDeletedWorkspace()` helper if set — none of the three do this today.
- `lib/permissions/workspace-access.ts`: add `hasImplicitListAccess(role: WorkspaceRole | null | undefined): boolean`, returning whether the role grants Owner-equivalent implicit access to every List in the Workspace (currently just `role === "OWNER"`, matching `resolveListAccess`'s own Owner check). `list-browsing.ts` and `global-search.ts` switch their `canSeeEveryList` computation to call it instead of inlining the role comparison.
- `list-roles.ts` is unchanged — its role filters group already-authorized, already-fetched rows for display, not an authorization decision.
- No new `resolveWorkspaceAccess` module. `canManageWorkspace`, `canAccessWorkspaceSettings`, `canViewWorkspaceMembers` are unchanged.
- No schema change, no DB constraint or trigger.

## Testing Decisions

- Add unit test cases to `lib/permissions/list-access.test.ts` covering: a `ListMember` row with no backing `WorkspaceMember` resolves as if absent; the same List, same User, with a `Guest` row instead of (or in addition to) the orphaned `ListMember`, still resolves normally; and the existing covered cases (Owner, each List role with full membership, Viewer ceiling) are unaffected.
- Add a regression case to whichever of `list-membership.integration.test.ts` / `workspace-membership.integration.test.ts` already covers it: after `removeWorkspaceMember`/`leaveWorkspace` cleanup, confirm no `ListMember` row remains for that User in that Workspace (hygiene, not just the `resolveListAccess` defense).
- Extend `list-creation.test.ts`/`list-creation.integration.test.ts`, `list-labels.test.ts` (or integration equivalent), and `workspace-peer-comparison.integration.test.ts` with a case: the acting User's Workspace is soft-deleted, the action is refused, matching the pattern already used for deleted-Workspace tests elsewhere (e.g. `list-browsing.integration.test.ts`).
- Add a new cross-check test (new or extending `list-browsing.integration.test.ts`/`global-search.integration.test.ts`) that, for a constructed matrix of roles (Owner, Admin, Member with a List role, Member without one, Viewer, Guest) against both an active and a soft-deleted Workspace, asserts `browseLists`'s/`globalSearch`'s inclusion of a List matches whether `resolveListAccess` for that same User/List returns at least `READ`.
- Follow the existing per-module test seam (unit vs. integration) rather than introducing a new one.

## Out of Scope

- A `resolveWorkspaceAccess` level-resolver module — explicitly rejected by ADR 0019, not deferred.
- Any DB constraint or trigger for either invariant.
- Any change to `list-roles.ts`.
- Re-architecting `resolveListAccess` to compose with any Workspace-level resolver.

## Further Notes

- The `hasImplicitListAccess()` predicate's name and shape should read as a direct counterpart to `resolveListAccess`'s own inline Owner check, since the two must never drift from each other — consider a comment cross-referencing both directions.
- This spec's call sites are few and independent enough to implement as one vertical slice rather than being broken into multiple tickets.
