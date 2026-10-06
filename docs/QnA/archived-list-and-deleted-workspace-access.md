# Grill Session: Archived List and Deleted Workspace Access

## Context

Design ticket [#85](https://github.com/codesuke/ListItUp/issues/85) ("Access to deleted or archived Workspaces and Lists"), with audit input from [#81](https://github.com/codesuke/ListItUp/issues/81): `resolveListAccess` (`lib/permissions/list-access.ts`) already returns `NONE` for every role, including the Workspace Owner, when the Workspace is soft-deleted (`isDeletedWorkspace`, settled by #76) — that part was already correct by the time this session ran. It does not look at `List.archivedAt` at all: an archived List resolves access exactly like an active one. No mutation (`setListStatus`, `updateListDescription`, item creation, section/custom-field/membership/Guest changes, …) checks `archivedAt` either, so a Lead can freely edit an archived List today. Search, the Workspace switcher, and `canExportList`'s deleted-Workspace handling were also audited and found already correct — the #81 comment claiming they "ignore deletion" was stale.

This session settles what `resolveListAccess` should do about an archived List, which actions stay allowed on one, and whether the deleted-Workspace blackout needs a narrower carve-out.

## Questions

### 1. Should "archived" be a ceiling inside `resolveListAccess` (like the Workspace Viewer ceiling), or stay orthogonal to it?

**Recommended answer**: Keep `resolveListAccess` purely role-based; archived Lists get a separate check at each mutation call site.

**Why**: a ceiling would force `restoreList`'s own LEAD-gated check to also see a downgraded level for the Lead trying to restore it, needing a carve-out anyway. `browseLists` already treats `archivedAt` as an orthogonal filter, not a role concern — this keeps that precedent.

**User answer**: Confirmed — separate check, not a ceiling.

### 2. Which actions should be blocked on an archived List?

**Recommended answer**: Block every mutation except `restoreList` itself. `archiveList` refuses to re-archive an already-archived List and `restoreList` refuses to restore a non-archived one, both no-ops mirroring how deleting an already-deleted Workspace is refused (#75). Reads, browse, search, and export all stay allowed.

**User answer**: Confirmed — block every mutation except restore.

### 3. For a soft-deleted Workspace, should the Owner get any narrower List-level access (read/export one List) during the Restore Window, instead of the current full blackout?

**Recommended answer**: No change — keep the full blackout. `restoreWorkspace()` already bypasses `resolveListAccess` entirely (it checks `WorkspaceMember.role` directly), mirroring the List-level answer to Q1/Q2. The Owner already sees the Workspace's name and restore deadline on the "Deleted Workspaces" list (#77) without needing List-level access to decide whether to restore.

**User answer**: Confirmed — full blackout, no code change needed on the deleted-Workspace side.

### 4. Does the "private List must be invisible, not discoverable via guessed URL" rule need dedicated tests for these two cases?

**Recommended answer**: Yes. ADR 0009/0017 and existing tests cover "no role at all → NONE," which is a different code path reason than "had a role, but the Workspace was deleted out from under me" or "the List got archived." Add dedicated regression tests for both.

**User answer**: Confirmed — add dedicated tests for both cases.

### 5. Is starring/unstarring exempt from the "block every mutation" rule for an archived List?

**Recommended answer**: Yes, exempt. `Starred` is scoped to one User and never touches the List's own data, so it doesn't fit "archived = frozen snapshot of the List itself." A User should be able to star or unstar an archived List freely (e.g. to tidy up their sidebar) without restoring it first.

**User answer**: Confirmed — starring stays allowed on archived Lists.

## Settled Outcomes

- `resolveListAccess` stays purely role-based: `List.archivedAt` never changes the resolved `ListAccessLevel`. `Workspace.deletedAt` already correctly forces `NONE` for everyone, including the Owner — no change needed there.
- Every List mutation except `restoreList` is blocked on an archived List via a new, orthogonal "is this List archived" check added at each mutation call site (not inside `resolveListAccess`). `archiveList`/`restoreList` themselves no-op harmlessly if the List is already in the target state.
- Starring/unstarring (`lib/list/list-starring.ts`) is exempt from the archived-mutation block — it is a per-User bookmark, not a change to the List itself.
- Reads, List browsing, global search, and CSV export all stay fully allowed on an archived List, unchanged from today.
- The deleted-Workspace blackout (`resolveListAccess` → `NONE` for everyone, Owner included, with `restoreWorkspace()` as the only bypass) is confirmed correct as-is; no code change.
- Dedicated regression tests are required for: (a) a List under a deleted Workspace resolves to `NONE`/not-found for every role including the former Owner/Lead, by direct URL; (b) an archived List still resolves its normal role-based access level, but every mutation call site refuses with a `list-archived` result while reads/export/starring still succeed.
- Out of scope: UI treatment (read-only banner, disabled controls) is an acceptance criterion of the implementation spec, not a decision point here — there was no real alternative to "the UI should reflect the server-side rule."

Recorded in [ADR 0018](../ADR/0018-archived-list-access-stays-orthogonal-to-resolvelistaccess.md) and implemented per `docs/Specs-Planned/archived-list-mutation-guard.md`.
