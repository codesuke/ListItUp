# RBAC Invariant Enforcement Seams

`docs/QnA/rbac-invariant-enforcement-seams.md` (resolving [issue #86](https://github.com/codesuke/ListItUp/issues/86)) settled where two RBAC invariants are enforced. L1 (a `ListMember` row trusted without a corresponding `WorkspaceMember`) is now a defensive check inside `resolveListAccess` itself — the one seam every List-scoped authorization check already goes through — not just cleanup-on-exit. The never-empty-Lead rule stays enforced at every mutation that can remove or demote a Lead-bearing row, via the existing shared locking helper (`lockAndCountSoleLeadLists`/`lockAndInspectListMember`) called inside each mutation's own transaction — ratified as the chosen mechanism, not a DB constraint or trigger. A new `resolveWorkspaceAccess` level-resolver, mirroring `resolveListAccess`'s shape, replaces 5 call sites' hand-rolled Workspace-role compares.

## Status

accepted

## Considered Options

**L1 (stale ListMember without WorkspaceMember):**
- Cleanup-on-exit only (the existing `clearWorkspaceListAccess`, called from `removeWorkspaceMember`/`leaveWorkspace`). Rejected as the sole mechanism: it only prevents orphans at the two mutations that call it: any missed or buggy cleanup path — or a bug predating this ADR, as evidenced by the data-migration commit that repaired exactly this damage — leaves a silent privilege leak until someone notices.
- A defensive check inside `resolveListAccess`: no `WorkspaceMember` → `NONE`, regardless of any `ListMember`/`Guest` row. Chosen as primary, with cleanup-on-exit kept as secondary hygiene (stale rows don't linger even though they're now harmless).

**Never-empty-Lead rule:**
- A Postgres constraint or trigger refusing a delete/update that would leave a List with zero Lead rows. Rejected: no precedent in this codebase, and `docs/Specs-Planned/domain-model-schema-migration-and-permissions.md` already rejected DB-constraint-only enforcement for the structurally similar "exactly one Owner" invariant — Postgres has no native "at least one matching row must remain" constraint without a trigger, and a trigger moves invariant logic out of reviewable TypeScript.
- The existing shared-locking-helper-per-mutation pattern, already covering every current write path with no bypass found. Chosen — ratifies what was already working. Future call sites are kept honest by convention and a doc comment on the helper, not a new structural/grep-based test.

**The 8 raw Workspace-role compares (#81 audit):**
- 3 of the 8 (`list-roles.ts`) turned out to be display-grouping of already-fetched List-role rows, not a Workspace-role authorization check — excluded; the audit miscounted these.
- For the real 5: extend `lib/permissions/workspace-access.ts` with a full `resolveWorkspaceAccess` level-resolver (`WorkspaceAccessLevel`: `NONE`/`VIEWER`/`MEMBER`/`ADMIN`/`OWNER`, mirroring `ListAccessLevel`'s shape and folding in the deleted-Workspace check), rather than a narrower fix of only swapping the 3 `canManageWorkspace`-shaped compares and extracting one more predicate for the 2 Owner-only compares. Chosen over the narrower fix — the user's call, since Workspace-level checks don't currently need layered ceiling logic, but valued the symmetry with `resolveListAccess` and the bonus `deletedAt` fix it gives 3 call sites that lacked it. Existing boolean predicates (`canManageWorkspace`, `canAccessWorkspaceSettings`, `canViewWorkspaceMembers`) become thin wrappers over the resolved level rather than being removed, preserving call-site readability.
- `resolveListAccess` composing on `resolveWorkspaceAccess` internally. Rejected for this ADR: `resolveListAccess` is already shipped and heavily tested; this session's scope is L1, the Lead rule, and the raw compares, not a rewrite of a function every List-scoped check depends on. Left as a possible future refactor if real duplication pain shows up.

## Consequences

- `resolveListAccess` now returns `NONE` whenever no `WorkspaceMember` row exists, closing the orphaned-`ListMember` privilege leak at its one mandated seam rather than depending on every mutation that could create one remembering to clean up.
- `lib/permissions/workspace-access.ts` gains `resolveWorkspaceAccess`, `WorkspaceAccessLevel`, `meetsWorkspaceAccessLevel`, and `hasImplicitListAccess`, alongside the existing (now-derived) `canManageWorkspace`/`canAccessWorkspaceSettings`/`canViewWorkspaceMembers`.
- `list-creation.ts`, `list-labels.ts`, and `workspace-peer-comparison.ts` gain deleted-Workspace handling they previously lacked, as a side effect of routing through the new resolver.
- `list-browsing.ts` and `global-search.ts` import `hasImplicitListAccess` instead of each hard-coding `role === "OWNER"`.
- The hand-rolled visibility OR-filters in `browseLists`/`globalSearch` stay as bulk, set-based queries (not replaced by a per-row `resolveListAccess` call, which would be an N+1 query) but gain a cross-check test pinning them against `resolveListAccess`'s per-row answer.
- Implementation is tracked in `docs/Specs-Planned/rbac-invariant-enforcement-seams.md`.
