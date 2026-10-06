# Grill Session: RBAC Invariant Enforcement Seams

## Context

Design ticket [#86](https://github.com/codesuke/ListItUp/issues/86) ("Where RBAC invariants are enforced"), with audit input from [#81](https://github.com/codesuke/ListItUp/issues/81) (rows 8, 18): `resolveListAccess` trusts a `ListMember` row without requiring a `WorkspaceMember` to exist (L1); 8 raw Workspace-role compares with no shared `resolveWorkspaceAccess`; hand-copied visibility ORs in `browseLists`/`globalSearch` that mirror `resolveListAccess`'s resolution order by hand and can drift from it. The most recent commit on `main` at the time of this session was a data migration repairing Lead-less Lists and stale Viewer role rows — direct evidence that L1-shaped gaps have already caused real damage, not just a theoretical risk.

Going in, the never-empty-Lead rule (settled by #83/ADR 0017/`docs/Specs-Planned/list-lead-rules.md`) was already enforced at every current write path — `removeListMember`, `changeListMemberRole`, `moveListRoleAssignment`, `removeWorkspaceMember`, `leaveWorkspace`, Viewer-demotion, account deletion — via one shared locking helper (`lockAndCountSoleLeadLists`/`lockAndInspectListMember` in `list-membership.ts`) called inside each mutation's own transaction. No bypass was found. L1's only defense was cleanup-on-exit (`clearWorkspaceListAccess`, called from `removeWorkspaceMember`/`leaveWorkspace`), not a defensive check in the read path.

Of the audit's "8 raw role compares," 3 (`list-roles.ts`'s role filters) turned out to be display-grouping of already-fetched `ListMemberRole` rows for a Roles tab, not a Workspace-role authorization check — the audit miscounted these. The real 5 were `list-creation.ts`, `list-labels.ts`, `workspace-peer-comparison.ts` (each re-declaring an OWNER-or-ADMIN role set that already exists as `canManageWorkspace()`), and `list-browsing.ts`/`global-search.ts` (each hard-coding `role === "OWNER"` for the Owner-sees-every-List rule `resolveListAccess` already encodes internally). "Item page" (`page-data.ts`) and "layout" (`layout-data.ts`) named by the audit turned out to have no raw role compares at all — `layout-data.ts` already calls the existing `canAccessWorkspaceSettings()` predicate; this matches the #85 session's finding that parts of the #81 audit were stale by the time of re-checking.

## Questions

### 1. Should L1 be defended inside `resolveListAccess` itself, or does cleanup-on-exit remain the sole mechanism?

**Recommended answer**: Add a defensive "no `WorkspaceMember` → `NONE`" check directly inside `resolveListAccess` as the primary mechanism. It's the one seam every List-scoped check is already mandated to call, so fixing it there protects every current and future call site at once — rather than depending on every mutation that could orphan a row remembering to clean up. Keep cleanup-on-exit too, as hygiene (stale rows shouldn't linger even once they're harmless).

**User answer**: Confirmed.

### 2. Should the never-empty-Lead rule's enforcement mechanism be a DB constraint/trigger, or the existing shared-helper-per-mutation pattern?

**Recommended answer**: Ratify the existing shared-helper-per-mutation pattern (`lockAndCountSoleLeadLists`/`lockAndInspectListMember`, called inside each mutation's transaction) as the one chosen mechanism. No DB trigger — zero precedent in this codebase, and `docs/Specs-Planned/domain-model-schema-migration-and-permissions.md` already rejects DB-constraint-only enforcement for the structurally similar "exactly one Owner" invariant, for the same reason: Postgres has no native "at least one matching row must remain" constraint without a trigger, and a trigger moves invariant logic out of reviewable TypeScript.

**User answer**: Confirmed.

### 3. How should future mutations be kept honest about calling the shared lock helper?

**Recommended answer**: Convention plus a doc comment on the helper mandating its use before any `ListMember`/`WorkspaceMember` delete or role-demotion — the same style `resolveListAccess`'s own doc comment already uses. Rely on code review and this ADR, not a new structural/grep-based test.

**User answer**: Confirmed.

### 4. How should the 5 real raw role-compares be consolidated?

**Recommended answer**: `list-creation.ts`, `list-labels.ts`, `workspace-peer-comparison.ts` switch to the existing `canManageWorkspace()` — pure drop-in. Add one new shared predicate for the Owner-sees-every-List rule, imported by `list-browsing.ts`/`global-search.ts` instead of each re-typing `"OWNER"`. `list-roles.ts` is left alone.

**User answer**: The user asked for more: build a full `resolveWorkspaceAccess` level-resolver rather than a narrower fix. See Question 5.

### 5. What should `resolveWorkspaceAccess` look like?

**Recommended answer**: A `WorkspaceAccessLevel` enum (`NONE`/`VIEWER`/`MEMBER`/`ADMIN`/`OWNER`, matching `WorkspaceRole`'s existing natural order) resolved from `{userId, workspaceId}`, returning `NONE` for no membership or a soft-deleted Workspace — mirroring `ListAccessLevel`'s shape. Bonus: `list-creation.ts`, `list-labels.ts`, and `workspace-peer-comparison.ts` don't check `deletedAt` today at all; routing them through this resolver closes that gap for free, not just the role-set duplication. Keep `canManageWorkspace`/`canAccessWorkspaceSettings`/`canViewWorkspaceMembers` as thin wrappers over the resolved level (one source of truth, same call-site readability) rather than deleting them; add `hasImplicitListAccess` as a new wrapper for the Owner-sees-everything case.

**User answer**: Confirmed.

### 6. Should `resolveListAccess` be refactored to compose on the new `resolveWorkspaceAccess`?

**Recommended answer**: No — leave `resolveListAccess` as-is. It's already shipped and heavily tested; #86's actual scope is L1, the Lead rule, and the raw compares, not a `resolveListAccess` rewrite. `resolveWorkspaceAccess` is a new, separate module. Revisit composition later if real duplication pain shows up.

**User answer**: Confirmed.

### 7. Should the hand-rolled visibility OR-filters in `browseLists`/`globalSearch` get a cross-check test against `resolveListAccess`?

**Recommended answer**: Yes. These two filters can't be replaced by calling `resolveListAccess` per row without an N+1 query, so the duplication itself is staying — but a dedicated test asserting they agree with `resolveListAccess`'s per-row answer across every role/Guest combination means a future `resolveListAccess` change that isn't mirrored here fails CI immediately instead of silently drifting.

**User answer**: Confirmed.

## Settled Outcomes

- `resolveListAccess` gains a defensive check: no `WorkspaceMember` row → `NONE`, regardless of any `ListMember`/`Guest` row found. This is the primary L1 defense; `clearWorkspaceListAccess`-style cleanup-on-exit remains as a secondary hygiene measure, not the sole guard.
- The never-empty-Lead rule's enforcement mechanism is ratified as the existing shared-locking-helper-per-mutation pattern. No DB constraint or trigger. Future call sites are kept honest by convention and a doc comment on the helper, not a new structural test.
- A new `lib/permissions/workspace-access.ts` export, `resolveWorkspaceAccess`, returns a `WorkspaceAccessLevel` (`NONE`/`VIEWER`/`MEMBER`/`ADMIN`/`OWNER`) from `{userId, workspaceId}`, folding in the deleted-Workspace check. `canManageWorkspace`, `canAccessWorkspaceSettings`, and `canViewWorkspaceMembers` become thin wrappers over the resolved level, preserving their call-site names. A new `hasImplicitListAccess` wrapper captures the Owner-sees-every-List rule.
- `list-creation.ts`, `list-labels.ts`, and `workspace-peer-comparison.ts` switch to `resolveWorkspaceAccess`/`canManageWorkspace`, gaining deleted-Workspace handling they lacked. `list-browsing.ts` and `global-search.ts` switch their hard-coded `role === "OWNER"` check to `hasImplicitListAccess`. `list-roles.ts` is untouched — its role filters are display grouping, not an authorization check, and the audit's inclusion of them was a miscount.
- `resolveListAccess` is explicitly left unchanged and uncomposed with `resolveWorkspaceAccess` — out of scope for this session.
- A new cross-check test asserts `browseLists`'s and `globalSearch`'s hand-rolled visibility OR-filters agree with `resolveListAccess`'s per-row answer across a representative role/Guest matrix, pinning the drift risk named by the #81 audit.
- The #81 audit's claims about "item page" and "layout" having raw role compares were stale — both already route through existing shared predicates.

Recorded in [ADR 0019](../ADR/0019-rbac-invariant-enforcement-seams.md) and implemented per `docs/Specs-Planned/rbac-invariant-enforcement-seams.md`.
