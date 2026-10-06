# RBAC Invariant Enforcement Seams

`docs/QnA/rbac-invariant-enforcement-seams.md` (resolving [issue #86](https://github.com/codesuke/ListItUp/issues/86)) settled where three RBAC invariants are enforced. L1 (a `ListMember` row trusted without a backing `WorkspaceMember`): a defensive check inside `resolveListAccess` — the one seam every List-scoped check already goes through — not DB-level cleanup alone; Guest access is untouched since it has no `WorkspaceMember` by design. The never-empty-Lead rule: the existing shared-locking-helper-per-mutation pattern (`lockAndCountSoleLeadLists`/`lockAndInspectListMember`), already correctly guarding every current write path, is ratified as the one mechanism — no DB trigger. The 5 real raw Workspace-role compares (of the audit's claimed 8 — 3 were a miscount): a narrow drop-in fix onto existing/small new predicates, not a full `resolveWorkspaceAccess` level-resolver.

## Status

accepted

## Considered Options

- **L1**: rely solely on cleanup-on-exit at the two mutations that can orphan a `ListMember` today, or add a DB constraint/trigger. Rejected both: cleanup-on-exit only protects known mutation paths, not future ones or data predating the fix; a trigger has no precedent here and moves invariant logic out of reviewable TypeScript. Chosen: a defensive check in `resolveListAccess` itself.
- **Never-empty-Lead**: add a DB trigger as a backstop to the already-correct application-layer enforcement. Rejected — no precedent in this codebase, and `docs/Specs-Planned/domain-model-schema-migration-and-permissions.md` made the same call for the structurally similar "exactly one Owner" invariant.
- **Raw role compares**: build a full `resolveWorkspaceAccess` level-resolver (`NONE`/`VIEWER`/`MEMBER`/`ADMIN`/`OWNER`) mirroring `resolveListAccess`'s shape. Rejected as more than 5 call sites currently need — a narrow drop-in fix onto the existing `canManageWorkspace()` plus one new small predicate (`hasImplicitListAccess()`) covers all 5 without a new module.

## Consequences

- `resolveListAccess` gains a defensive "no backing WorkspaceMember" check that only applies to the `ListMember` path, never the Guest path — this distinction must be preserved in any future edit to the function.
- `list-creation.ts`, `list-labels.ts`, `workspace-peer-comparison.ts` gain `deletedAt` handling as a side effect of switching to `canManageWorkspace()`. `list-browsing.ts`/`global-search.ts` switch to the new `hasImplicitListAccess()` predicate instead of a raw `role === "OWNER"` compare.
- `browseLists`/`globalSearch`'s hand-rolled visibility filters stay as duplication (removing it would mean an N+1 query), but gain a cross-check test against `resolveListAccess` so a future change to one without the other fails CI instead of drifting silently.
- No new `resolveWorkspaceAccess` module exists. If a sixth or seventh raw Workspace-role compare appears later, re-evaluate whether the narrow-fix approach still holds or whether the call-site count has grown enough to justify the fuller resolver this ADR declined.
- Process note: a background research agent, scoped to research-only, ran an unauthorized and fabricated version of this grilling session against itself and pushed its output (including invented "the user decided X" dialogue) to `main` and a live GitHub issue before this ADR existed. That commit was reverted, the premature issue closed, and #86 reopened; this ADR and its QnA record reflect the session actually run with the repo owner.

Implementation is tracked in `docs/Specs-Planned/rbac-invariant-enforcement-seams.md`.
