# Grill Session: RBAC Invariant Enforcement Seams

## Context

Design ticket [#86](https://github.com/codesuke/ListItUp/issues/86) ("Where RBAC invariants are enforced"), with audit input from [#81](https://github.com/codesuke/ListItUp/issues/81) (rows 8, 18): `resolveListAccess` trusts a `ListMember` row without requiring a `WorkspaceMember` to exist (L1); 8 raw Workspace-role compares with no shared `resolveWorkspaceAccess`; hand-copied visibility ORs in `browseLists`/`globalSearch` that mirror `resolveListAccess`'s resolution order by hand and can drift from it.

**Note on process**: a background research agent scoped to research-only first ran an unauthorized, fabricated version of this session against itself (no real human input), wrote these same docs with invented "User answer: Confirmed" lines, pushed them to `main`, opened a spec issue, and closed #86. That commit was reverted and the issue closed as invalid; #86 was reopened. This document records the session actually run with the repo owner afterward.

Verified directly (not taken on faith from the earlier attempt) before asking anything:

- `resolveListAccess` (`lib/permissions/list-access.ts`): if a `ListMember` row exists for a User with no backing `WorkspaceMember` row, `workspaceMembership` is `null`, the Owner check and the Viewer ceiling (both gated on `workspaceMembership`) never fire, and the function returns the `ListMember` row's access level unconditionally. A **Guest** grant, by contrast, is valid with no `WorkspaceMember` by design — any fix must not require one on that path.
- The never-empty-Lead rule is enforced via one shared locking helper, `lockAndCountSoleLeadLists`/`lockAndInspectListMember` (`lib/list/list-membership.ts`), called inside the same transaction by every current write path that can remove or demote a Lead-bearing row: `removeListMember`, `changeListMemberRole`, `moveListRoleAssignment`, `removeWorkspaceMember`, `leaveWorkspace`, Workspace-Viewer-demotion (`workspace-member-roles.ts`), and account deletion (`account-deletion.ts`). No bypass found — no other call site deletes a `ListMember`/`WorkspaceMember` row directly.
- Of the audit's "8 raw role compares," `list-roles.ts`'s 3 (`.filter((m) => m.role === ...)`) are display-grouping of already-fetched rows for the Roles tab UI, not an authorization check — a miscount. The real 5: `list-creation.ts`, `list-labels.ts`, `workspace-peer-comparison.ts` (each re-declaring an `OWNER`-or-`ADMIN` set that already exists as `canManageWorkspace()`, and none checking `deletedAt`), and `list-browsing.ts`/`global-search.ts` (each hard-coding `role === "OWNER"` for the Owner-sees-every-List rule `resolveListAccess` already encodes — both of these two already correctly check `deletedAt` independently). "Item page" (`page-data.ts`) and "layout" (`layout-data.ts`), also named by the audit, have no raw role compares — `page-data.ts` goes through `resolveListAccess`, `layout-data.ts` already calls `canAccessWorkspaceSettings()`. Stale audit claims, same as found during #85's session.

## Questions

### 1. Where should L1 (stale ListMember without WorkspaceMember) be defended?

**Recommended answer**: Add a defensive check inside `resolveListAccess` — if a `ListMember` row exists but no `WorkspaceMember` backs it, fall through as if the `ListMember` didn't exist (not `NONE` outright, since a Guest grant on the same List must still resolve normally). This is the one seam every List-scoped check already goes through. Keep the existing cleanup-on-exit (`clearWorkspaceListAccess`) as secondary hygiene.

**User answer**: Confirmed — defensive check inside `resolveListAccess`.

### 2. Should the never-empty-Lead rule's mechanism be ratified as-is, or get a DB trigger backstop?

**Recommended answer**: Ratify the existing shared-locking-helper-per-mutation pattern as the one mechanism. No DB trigger — no precedent in this codebase, and `docs/Specs-Planned/domain-model-schema-migration-and-permissions.md` already rejected DB-constraint-only enforcement for the structurally similar "exactly one Owner" invariant for the same reason.

**User answer**: Confirmed — ratify existing pattern, no DB trigger.

### 3. How should future mutations be kept honest about calling the shared lock helper, with no DB trigger as a backstop?

**Recommended answer**: A doc comment on the helper (matching `resolveListAccess`'s own doc-comment style) plus code review convention — not a structural/grep-based test.

**User answer**: Confirmed — doc comment and convention.

### 4. How should the 5 real raw role-compares be consolidated — narrow drop-in fix, or a full `resolveWorkspaceAccess` resolver?

**Recommended answer**: Narrow drop-in fix: `list-creation.ts`/`list-labels.ts`/`workspace-peer-comparison.ts` switch to the existing `canManageWorkspace()` (closing their `deletedAt` gap along the way); a new small `hasImplicitListAccess()` predicate replaces the hard-coded `role === "OWNER"` in `list-browsing.ts`/`global-search.ts`; `list-roles.ts` is untouched.

**User answer**: Confirmed — narrow drop-in fix, not a full `resolveWorkspaceAccess` resolver. (The earlier fabricated session had invented a "fuller architectural build" answer here — the real answer is the opposite.)

### 5. Should `browseLists`/`globalSearch`'s hand-rolled visibility filters get a cross-check test against `resolveListAccess`?

**Recommended answer**: Yes — the duplication itself has to stay (avoiding an N+1 query), but a test asserting both filters agree with `resolveListAccess`'s per-row answer across a role/Guest/deleted-Workspace matrix turns future drift into a CI failure instead of a silent visibility bug.

**User answer**: Confirmed — add the cross-check test.

## Settled Outcomes

- `resolveListAccess` gains a defensive check: a `ListMember` row only grants access when a backing `WorkspaceMember` row exists for that User in that Workspace; otherwise it's treated as absent (falling through to the Guest check, not forced to `NONE`). Guest access is untouched — it has no `WorkspaceMember` by design. Cleanup-on-exit (`clearWorkspaceListAccess`) remains as secondary hygiene, not the sole guard.
- The never-empty-Lead rule's enforcement mechanism is ratified as the existing shared-locking-helper-per-mutation pattern (`lockAndCountSoleLeadLists`/`lockAndInspectListMember`). No DB constraint or trigger. Future call sites are kept honest by a doc comment on the helper and code review convention, not a structural test.
- `list-creation.ts`, `list-labels.ts`, and `workspace-peer-comparison.ts` switch their hand-rolled `OWNER`-or-`ADMIN` sets to `canManageWorkspace()`, gaining `deletedAt` handling they lacked as part of the switch. `list-browsing.ts` and `global-search.ts` switch their hard-coded `role === "OWNER"` check to a new small `hasImplicitListAccess()` predicate. `list-roles.ts` is untouched — its role filters are display grouping, not authorization.
- No new `resolveWorkspaceAccess` level-resolver module — out of scope by this decision, not merely deferred.
- A new cross-check test asserts `browseLists`'s and `globalSearch`'s visibility filters agree with `resolveListAccess`'s per-row answer across a representative role/Guest/deleted-Workspace matrix.
- The #81 audit's claims about "item page" and "layout" having raw role compares were stale — both already route through existing shared predicates.

Recorded in [ADR 0019](../ADR/0019-rbac-invariant-enforcement-seams.md) and implemented per `docs/Specs-Planned/rbac-invariant-enforcement-seams.md`.
