# Notification Generalized Beyond Item

Issue [#89](https://github.com/codesuke/ListItUp/issues/89) needed an in-app Notification for Workspace membership removal and role change, neither of which has an Item to anchor to — every existing `Notification` row did. `itemId` was a required FK.

## Status

accepted

## Considered Options

- **A separate `WorkspaceNotification` table** mirroring `Notification`'s per-recipient read/bookmark/archive columns. Rejected: it would fork the Updates surface into two query paths, two unread counts to sum, and duplicated read/bookmark/archive semantics for what the product treats as one inbox.
- **Generalize `Notification`**: make `itemId` nullable, add a nullable `workspaceId` (anchoring a membership notice directly to its Workspace) and a nullable `newRole` (snapshotting a role change so it still reads correctly if the role changes again before the recipient opens it). Chosen — one inbox, one unread count, one read/bookmark/archive mechanism for every notification type.

## Consequences

- Every read path in `lib/notification/notification-inbox.ts` branches on `itemId`/`workspaceId` instead of assuming an Item join; the Deleted-Workspace exclusion (`#76`) is now an `OR` over both paths rather than a single join.
- `Notification.itemId` is nullable going forward — any new type added to `NotificationType` must decide which of `itemId`/`workspaceId` it populates, not assume an Item exists.
- A non-Item notification carries no `noteId`/`dueDateAt` either; the existing `@@unique([recipientId, itemId, type, dueDateAt])` constraint still holds since Postgres treats multiple `NULL` `itemId` rows as distinct, so repeat membership notices for the same recipient are never silently deduped away.
