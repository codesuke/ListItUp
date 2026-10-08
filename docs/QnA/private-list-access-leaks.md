# Grill Session: Private-List Access Leaks via Assignment, Notifications and Cross-List Surfaces

## Context

Design ticket [#87](https://github.com/codesuke/ListItUp/issues/87) ("Private-List leaks via assignment, notifications and cross-List surfaces"), part of the RBAC fixes map ([#80](https://github.com/codesuke/ListItUp/issues/80)), with audit input from [#81](https://github.com/codesuke/ListItUp/issues/81). A code survey ahead of this session confirmed every audit claim still holds on `main`:

- `addAssignee`/`removeAssignee` (`lib/item/item-assignment.ts`) check only the *actor's* access to the item's List — never the target `userId`'s. An integration test (`item-assignment.integration.test.ts`) exercises this directly: assigning a brand-new User with no `WorkspaceMember`/`ListMember`/`Guest` row at all succeeds.
- Notification creation (`lib/notification/notification-triggers.ts`) checks access for @mention recipients only, not for assignee/state-change recipients. The read path (`lib/notification/notification-inbox.ts`) is scoped purely by `recipientId`, by an explicit design comment stating a Notification is "already access-controlled at creation time" — true for mentions, not for the other trigger types. Notification titles are a live join to `Item.title`, not denormalized, so a recipient who has since lost access still sees the item's *current* title.
- My Tasks (`item-my-tasks.ts`) filters only by `assigneeId` + "Workspace not deleted." Items I've Assigned (`item-assigned-by-me.ts`) filters only by `creatorId` + `workspaceId` — it doesn't even exclude a deleted Workspace.
- `ItemDependency` (`item-dependencies.ts`) correctly requires WRITE on both items to *create* a blocking link, but rendering an item's `blocking`/`blockedBy` list (`page-data.ts`) shows the other item's title and `listId` with no re-check against the viewer's access to that other List.
- `PersonalNote` (`item-notes.ts`): writing requires the actor to currently be an `ItemAssignee`; reading checks nothing beyond the row being keyed to the caller's own `[itemId, userId]` — no List-access or still-assignee check on either path.
- `resolveListAccess` already returns `NONE` for everyone (including the Owner) once the Workspace is soft-deleted. Per [ADR 0018](../ADR/0018-archived-list-access-stays-orthogonal-to-resolvelistaccess.md), an archived List is deliberately *not* a ceiling inside `resolveListAccess` — archiving is enforced per-mutation, not as a read-time access change.

This session settles how these surfaces should behave once access is granted, used, and later revoked.

## Questions

### 1. Should assignee/recipient access be validated at write time, filtered at read time, or both?

**Recommended answer**: Both. Write time: `addAssignee` must require the target User to resolve to at least `READ` access on the item's List, rejecting otherwise. Read time: Notifications/inbox, My Tasks, Home, and Items I've Assigned must additionally re-check the *viewer's* current access, since access can be revoked after a valid assignment and only a read-time check catches that.

**Why**: a write-time-only fix stops new leaks but not existing ones that go stale after a later access revocation; a read-time-only fix leaves the write path silently accepting assignments to users with no access at all, which is also wrong on its own terms.

**User answer**: Confirmed — both, and confirmed `READ` (not `WRITE`) as the floor required to be assignable; a capped Viewer/Guest can still legitimately be an intended assignee for visibility even if they can't act on it themselves.

### 2. What happens to existing assignments and notifications when access is lost — hide, delete, or keep dormant?

**Recommended answer**: Hide only, via the Question 1 read-time filter — do not delete the underlying `ItemAssignee`/`Notification` rows.

**Why**: deletion buys nothing beyond what the filter already achieves, and it breaks a clean invariant — if access is later restored (re-added to the List, Guest re-granted), the assignment/notification should reappear automatically rather than needing to be redone. This is narrower than issue [#82](https://github.com/codesuke/ListItUp/issues/82)'s already-decided case (full Workspace departure), where assignments, Guest grants, and pending invitations *are* cleaned up — #87 covers access lost while the User is still in the Workspace (removed from the List, Guest revoked, or role downgraded to Viewer).

**User answer**: Confirmed — hide via read-time filtering, no deletion.

### 3. What does a READ user see for a linked Item (cross-List `ItemDependency`) they can't read — an opaque placeholder, or nothing?

**Recommended answer**: Opaque placeholder (e.g. "Blocked by an item you don't have access to"), not full omission.

**Why**: the dependency's existence was already established by someone with WRITE on both items at creation time, so the existence of the link isn't the secret — only the other item's title/content is. Omitting it entirely would make the UI inconsistent (an item could show state "Blocked" with an empty blockers list, reading as a bug rather than a boundary).

**User answer**: Confirmed — opaque placeholder.

### 4. Does a deleted Workspace or archived List drop items out of My Tasks/Home?

**Recommended answer**: Deleted Workspace — yes, for free, once Question 1's read-time check lands (`resolveListAccess` already returns `NONE` for a deleted Workspace), which also fixes Items I've Assigned's existing gap of not excluding deleted Workspaces at all. Archived List — this needs a *separate*, dedicated UX filter (`archivedAt IS NULL`) in My Tasks/Home/Items I've Assigned, since per ADR 0018 an archived List's `resolveListAccess` level is unchanged from active, so the read-time access check alone would not drop its items.

**Why**: ADR 0018 settled that archiving is orthogonal to access level by design (so `restoreList` itself doesn't get caught by its own ceiling); this session doesn't revisit that. But a frozen/closed List's items cluttering an active task queue is a legitimate, separate UX concern even for a User who still technically has access.

**User answer**: Confirmed — deleted-Workspace exclusion falls out of Question 1/2's fix; archived-List items are additionally filtered out of the task-queue surfaces as a dedicated UX filter, independent of `resolveListAccess`/ADR 0018.

### 5. (Raised during this session, not in the original ticket) Should Personal Notes gain a READ floor?

**Recommended answer**: Yes — add a `resolveItemAccess` READ-floor check to both `getPersonalNote` and `upsertPersonalNote`, in addition to (not replacing) the existing "is currently an assignee" check on the write path.

**Why**: `getPersonalNote` today has no access check at all (it can't leak cross-user, since it's keyed to the caller's own `[itemId, userId]`, but it will still return a note for an item the caller can no longer see at all). More importantly, because Question 2 settles that stale `ItemAssignee` rows are kept (not deleted) once access is lost, `upsertPersonalNote`'s "is assignee" check alone is no longer sufficient to prove current access — a User with a dormant assignee row but no current List access could otherwise keep writing notes on an item they shouldn't be able to see.

**User answer**: Confirmed — READ floor added to both read and write paths.

## Settled Outcomes

- `addAssignee` requires the target User to resolve to at least `READ` access on the item's List (via `resolveListAccess`/`resolveItemAccess`); rejects otherwise.
- Notifications/inbox, My Tasks, Home, and Items I've Assigned all re-check the viewer's *current* List access at read time, on top of whatever access existed at creation/assignment time.
- Revoked access hides existing `ItemAssignee`/`Notification` rows via the read-time filter above; it never deletes them. Full-departure cleanup (issue #82) is unaffected and unchanged.
- A cross-List `ItemDependency` the viewer can't read renders as an opaque placeholder, not omitted.
- `getPersonalNote` and `upsertPersonalNote` both gain a `resolveItemAccess` READ-floor check, alongside (not replacing) the existing "is assignee" check on the write path.
- My Tasks, Home, and Items I've Assigned additionally exclude archived-List items via a dedicated `archivedAt IS NULL` filter, independent of `resolveListAccess`; this does not change ADR 0018's "archived is orthogonal to access level" rule.
- Items I've Assigned also gains the deleted-Workspace exclusion it was previously missing, as a side effect of the read-time access check.

## Date

2026-10-08

## Follow-Ups

- Glossary updates: none — `CONTEXT.md`'s existing Assignee/Personal Note/Guest definitions already describe the intended domain shape; these are enforcement fixes, not new concepts.
- ADRs created: [0021](../ADR/0021-private-list-access-leaks-write-and-read-time-enforcement.md).
- Specs affected: `docs/Specs-Planned/private-list-access-leaks.md`, published to the issue tracker as [#107](https://github.com/codesuke/ListItUp/issues/107).
