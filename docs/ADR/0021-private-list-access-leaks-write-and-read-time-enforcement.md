# Private-List Access Leaks: Write- and Read-Time Enforcement

`docs/QnA/private-list-access-leaks.md` (resolving [issue #87](https://github.com/codesuke/ListItUp/issues/87)) settled how private-List access is enforced on surfaces other than the List itself. Assignment gains a write-time check (the target must resolve to at least `READ`); Notifications, My Tasks, Home, and Items I've Assigned gain a read-time re-check of the viewer's current access, layered on top of the write-time check rather than replacing it. Revoked access hides the underlying rows rather than deleting them. A cross-List `ItemDependency` the viewer can't read renders as an opaque placeholder. Personal Notes gain a READ floor on both read and write. Archived-List items get a dedicated UX filter in task-queue surfaces, independent of `resolveListAccess`.

## Status

accepted

## Considered Options

- **Enforcement point for assignee/recipient access**: write-time only, read-time only, or both. Write-time-only stops new leaks but not access revoked after a valid assignment. Read-time-only leaves the write path accepting assignments to Users with no access at all. Chosen: both — a write-time gate on `addAssignee`, and a read-time re-check on every surface that lists assignment- or recipient-scoped data.
- **Revoked-access row lifecycle**: hide (read-time filter, row kept), delete, or keep dormant with no filter. Deleting loses state and would require re-creating the assignment/notification if access is restored later. "Keep dormant with no filter" is simply not filtering, which is the leak itself. Chosen: hide via the read-time filter, row kept intact — access restoration becomes a free side effect of the row surviving.
- **Cross-List dependency rendering for an inaccessible item**: opaque placeholder vs. full omission. Omission would make the UI inconsistent (state "Blocked" with an empty blockers list). Chosen: opaque placeholder — the dependency's existence was already established by someone with WRITE on both items at creation time, so only the other item's content is sensitive, not the link's existence.
- **Archived List in task-queue surfaces**: fold into the read-time access re-check vs. a separate, dedicated filter. ADR 0018 already settled that an archived List's `resolveListAccess` level is unchanged from active — folding "archived" into the access re-check would mean re-opening that decision. Chosen: a separate `archivedAt IS NULL` filter in My Tasks/Home/Items I've Assigned, kept orthogonal to access resolution, consistent with ADR 0018.
- **Personal Note access check**: rely solely on "is currently an assignee" (the existing write-path check) vs. add an explicit `resolveItemAccess` READ floor. Relying only on "is assignee" stops working once stale assignee rows are kept rather than deleted (this ADR's own revoked-access decision) — a dormant assignee could keep reading/writing notes on an item they can no longer otherwise see. Chosen: an explicit READ floor on both `getPersonalNote` and `upsertPersonalNote`, additive to the existing assignee check.

## Consequences

- `addAssignee` (`lib/item/item-assignment.ts`) gains a `resolveItemAccess`/`resolveListAccess` call against the target `userId`, not just the actor; the existing integration test that currently asserts a zero-access assignment succeeds must be updated to assert rejection instead.
- `lib/notification/notification-inbox.ts`'s loaders, `lib/item/item-my-tasks.ts`, and `lib/item/item-assigned-by-me.ts` each gain a per-row (or per-List) current-access re-check at read time; this is new query cost on every read of these surfaces, accepted as the cost of closing a real leak rather than deferred.
- No `ItemAssignee` or `Notification` row is ever deleted as a side effect of access loss alone; only issue #82's already-decided full-departure cleanup deletes rows, and only in that distinct scenario.
- `page-data.ts`'s `blocking`/`blockedBy` mapping gains a per-dependency access check against the *other* item's List, with a placeholder shape for the inaccessible case — this is the first place in the codebase that needs to represent "an item that exists but the viewer can't read its content."
- `item-notes.ts`'s `getPersonalNote` and `upsertPersonalNote` both call `resolveItemAccess` going forward; `getPersonalNote`'s result for a caller who has lost List access changes from "returns the note" to "not found," even though the row still exists.
- My Tasks, Home, and Items I've Assigned each add an `archivedAt IS NULL` condition that is unrelated to and does not touch `resolveListAccess`, preserving ADR 0018's orthogonality. If a future session wants archived Lists visible again in these surfaces, this filter is the one place to remove, not `resolveListAccess`.
- Items I've Assigned additionally starts excluding deleted Workspaces as a side effect of adding the read-time access re-check — previously an independent, unticketed gap.

Implementation is tracked in `docs/Specs-Planned/private-list-access-leaks.md`.
