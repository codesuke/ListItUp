# Archived List Mutation Guard

## Problem Statement

Archiving a List is meant to freeze it as a read-only snapshot, but today only `archiveList`/`restoreList` themselves touch `archivedAt` — every other List- and Item-scoped mutation (changing status or description, adding members or Guests, editing sections or custom fields, creating or editing Items, moving an Item on a board, etc.) checks only the actor's role via `resolveListAccess`, never whether the List is archived. A List Lead (or the Workspace Owner) can freely keep editing an archived List's content and settings today, which contradicts what "Archived" is supposed to mean, and nothing in the UI signals that an archived List should be read-only either. Separately, the equivalent question for a soft-deleted Workspace — does `resolveListAccess` correctly lock everyone out, including the Owner, until the Workspace itself is restored — was already correct, but had no dedicated regression test naming that behavior.

This gap, and the resolution of how archived access should work, was settled in the grilling session resolving [issue #85](https://github.com/codesuke/ListItUp/issues/85), recorded in `docs/QnA/archived-list-and-deleted-workspace-access.md` and [ADR 0018](../ADR/0018-archived-list-access-stays-orthogonal-to-resolvelistaccess.md). This spec implements that resolution.

## Solution

Add an "is this List archived" check, independent of `resolveListAccess`'s role resolution, to every List- and Item-scoped mutation. The check blocks the mutation with a dedicated `list-archived` result whenever the List is archived, with three exemptions: `restoreList` (the way back to active), and the two purely per-User personal annotations that never touch the List's own shared data (starring/unstarring a List, and an Item's Personal Note). `archiveList` and `restoreList` themselves become idempotent-refuse, mirroring how deleting an already-deleted Workspace is refused. Reads, browsing, search, and CSV export are already unaffected and need no change. The deleted-Workspace blackout needs no behavior change, only dedicated regression tests naming it.

## User Stories

1. As a List Lead, I want the Workspace Owner or myself to be refused when trying to change an archived List's status or description, so that archiving actually freezes the List rather than only hiding it from the default browse tab.
2. As a List Lead, I want adding, removing, or changing the role of a List Member or Viewer on an archived List to be refused, so that List membership can't drift while the List is supposed to be frozen.
3. As a List Lead, I want granting or revoking a Guest's access to an archived List to be refused, so that Guest access can't change on a frozen List either.
4. As a List Lead, I want creating, renaming, duplicating, deleting, or reordering Sections on an archived List to be refused, so that the List's structure stays exactly as it was when archived.
5. As a List Lead, I want creating or updating a Custom Field definition on an archived List to be refused, for the same reason.
6. As a List Member, I want creating a new Item (directly, or via Quick Add) in an archived List to be refused, so that an archived List can't quietly grow new content.
7. As a List Member, I want editing an Item's title, Section, due date, priority, or Blocker reason, transitioning its state, or archiving/restoring the Item itself to be refused when the Item's List is archived, so that an archived List's existing Items are frozen too, not just the List's own fields.
8. As a List Member, I want adding or removing an Item's Assignees, applying or removing a Label, setting a Custom Field value, creating or removing a Dependency, or creating a Note to be refused when the Item's List is archived.
9. As a List Member, I want uploading a new Attachment to an Item in an archived List to be refused.
10. As a List Member, I want dragging an Item to a different Board column or Board role-assignment column to be refused when the List is archived, including from the cross-Workspace My Tasks board, so that board drag-and-drop can't bypass the freeze.
11. As any User with access to an archived List, I want to still open it, browse it, search for it, and export it as a CSV exactly as before, so that archiving never blocks reading or extracting the List's data.
12. As any User, I want starring or unstarring an archived List, and writing or editing my own Personal Note on one of its Items, to keep working, so that my purely personal annotations aren't frozen along with the List's shared data.
13. As a List Lead, I want trying to archive an already-archived List, or restore a List that isn't archived, to be refused harmlessly rather than erroring, so that a double click or a stale UI state doesn't surface a confusing failure.
14. As a developer, I want one shared way of expressing "this List is archived" so every call site's check is the same shape, so that a future mutation doesn't forget the guard or implement it inconsistently.
15. As a developer, I want a regression test asserting that a List under a soft-deleted Workspace resolves to `NONE` access (and not-found by direct URL) for every role, including the former Owner and Lead, so that this specific reason for "no access" — distinct from simply never having had a role — is named and protected from regressing.
16. As a developer, I want a regression test asserting that an archived List still resolves its normal role-based `resolveListAccess` level (proving archived status and access level are independent axes), while every mutation above is refused and reads/export/starring/Personal-Note still succeed.
17. As a User viewing an archived List, I want the page to visibly show it's archived and disable the controls for the mutations above, so that I learn this from the interface rather than by having a Server Action silently refuse.

## Implementation Decisions

- Add a single shared predicate (parallel to the existing `isDeletedWorkspace`) that takes a List's `archivedAt` and reports whether it's archived. Every mutation call site already fetches the List row before calling `resolveListAccess`, so this check costs no extra query.
- Extend every affected mutation's existing discriminated-union result type with a new `{ status: "list-archived" }` case, following the same pattern already used for `{ status: "forbidden" }` and `{ status: "list-not-found" }`. Order the check after existence and before (or alongside) the role check — a nonexistent List still reports not-found; an existing-but-archived List reports `list-archived` regardless of the actor's role, since even a Lead can't bypass it.
- For Item-scoped mutations, the check runs against the Item's parent List's `archivedAt`, not the Item's own lifecycle state.
- `archiveList` gains an idempotent-refuse case (`{ status: "already-archived" }` or equivalent) when the List is already archived; `restoreList` gains the symmetric `{ status: "not-archived" }` when it isn't. Neither is an error from the caller's perspective — both are a harmless no-op response.
- Exemptions, by name: `restoreList`, List starring/unstarring, and Item Personal Notes (`upsertPersonalNote`/`getPersonalNote`). Everything else enumerated in the User Stories gets the guard. `getPersonalNote` is a read and was never going to be blocked regardless.
- Board and My Tasks board drag-and-drop (`moveItemToColumn`, `moveListRoleAssignment`, `moveMyTasksItemToColumn`) resolve the dragged Item's/assignment's List and apply the same guard — these are mutations even though they're surfaced as a drag gesture, not a form submit.
- UI: the List page and board/My Tasks surfaces show an "Archived" indicator when `archivedAt` is set and disable (not hide) the controls for every blocked mutation, so a User understands why an action isn't available rather than discovering it only after a refused Server Action call. Read-only surfaces (description/status display, Item list, Sections, board columns) remain fully visible and interactive for scrolling/filtering/reading.
- No schema change: `List.archivedAt` already exists; this spec only adds call-site checks and UI treatment.

## Testing Decisions

- Unit-test the shared "is this List archived" predicate directly, same style as `workspace-visibility.test.ts`'s coverage of `isDeletedWorkspace`.
- For each affected mutation, extend its existing `*.test.ts`/`*.integration.test.ts` with a case: an actor who would otherwise be allowed (e.g. a Lead for List-level mutations, a Member for Item-level ones) is refused with `list-archived` once the List's `archivedAt` is set, and the mutation has no observable side effect. Follow the existing test seam per module — unit tests where the module already has pure unit tests, integration tests where it already requires the database.
- Add the two regression tests named in User Stories 15–16 as new cases in `lib/permissions/list-access.test.ts` (or its integration counterpart, matching existing seam conventions): deleted-Workspace List access is `NONE` for every role including the former Owner/Lead, and an archived List's `resolveListAccess` level is unchanged from its active-List value for every role.
- Test `archiveList`/`restoreList` idempotency as new cases alongside their existing tests in `list-lifecycle.test.ts`.
- Test the two exemptions (starring, Personal Notes) explicitly succeeding against an archived List, not just the blocked cases — a passing test suite that only ever asserts "refused" could hide an over-broad guard that accidentally also blocks an exempted action.
- Smoke-test the UI "Archived" indicator and disabled-controls treatment on the List page, following this repo's existing `*.smoke.test.tsx` pattern.

## Out of Scope

- Any change to `resolveListAccess`'s role resolution itself, or to the deleted-Workspace blackout's behavior — both were confirmed correct as-is by the grilling session; only tests are added for the latter.
- Any change to CSV export, List browsing, or global search — all three already correctly handle both deleted-Workspace and archived-List filtering.
- A new "frozen" or "locked" concept distinct from Archived — this spec enforces the existing Archived state more completely, it does not introduce a new state.
- Bulk/administrative tooling to find or report on Lists with stale mutation attempts against them.

## Further Notes

- This spec's Testing Decisions deliberately call out testing the exemptions succeeding, not only the blocked cases, because the failure mode of an over-eager guard (accidentally blocking starring or Personal Notes) is easy to introduce when the same "is archived" check is copy-adapted across ~20 call sites and easy to miss in review.
- The call-site count here is large but mechanical and uniform (the same two-line guard shape repeated with different result-type names) — when broken into tickets, group by module area (List settings; List membership/Guests; List structure/sections/custom fields/labels; Item CRUD/lifecycle/assignment/custom fields/dependencies/labels/notes/attachments; board and My Tasks board drag-and-drop) rather than one ticket per file, so each ticket stays an independently demoable vertical slice.
