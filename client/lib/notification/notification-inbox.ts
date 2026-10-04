import type { NotificationType, PrismaClient } from "@/generated/prisma/client";
import { ACTIVE_WORKSPACE_WHERE } from "@/lib/workspace/workspace-visibility";

// Every notification reads/writes below join through to the Item's
// Workspace and exclude a Deleted Workspace (#76) — a Notification row is
// otherwise access-controlled purely by recipientId (see the comment on
// loadActivityNotifications), so this is the one place that exclusion has
// to be added explicitly rather than inheriting it from a membership check.
const NOT_DELETED_WORKSPACE_ITEM = { item: { list: { workspace: ACTIVE_WORKSPACE_WHERE } } } as const;

// The Activity tab's explicit scope (#47): Assignee changes, Notes, Item
// state changes, and Mentions. DUE_DATE_REMINDER is a system-triggered
// reminder rather than a change another person made, and is deliberately
// left out of this list — it still counts toward the unread badge below,
// since the badge represents "does anything need my attention" rather than
// "is it in this particular tab" (#41's due-date reminder has no actor to
// attribute a feed entry to).
export type ActivityCategory = "assignee" | "notes" | "mentions" | "state";

export const ACTIVITY_CATEGORY_TYPES: Record<ActivityCategory, NotificationType[]> = {
  assignee: ["ASSIGNEE_ADDED", "ASSIGNEE_REMOVED"],
  notes: ["NOTE_ADDED"],
  mentions: ["MENTIONED"],
  state: ["STATE_CHANGED"],
};

export const ACTIVITY_TYPES: NotificationType[] = Object.values(ACTIVITY_CATEGORY_TYPES).flat();

export type ActivityNotification = {
  id: string;
  type: NotificationType;
  createdAt: Date;
  isUnread: boolean;
  isBookmarked: boolean;
  isArchived: boolean;
  actorName: string | null;
  itemId: string;
  itemTitle: string;
  itemHref: string;
};

const DESCRIPTION_BY_TYPE: Record<NotificationType, (actorName: string) => string> = {
  ASSIGNEE_ADDED: (actorName) => `${actorName} assigned you to`,
  ASSIGNEE_REMOVED: (actorName) => `${actorName} removed you from`,
  NOTE_ADDED: (actorName) => `${actorName} added a note on`,
  MENTIONED: (actorName) => `${actorName} mentioned you on`,
  STATE_CHANGED: (actorName) => `${actorName} changed the state of`,
  DUE_DATE_REMINDER: () => "Due date approaching for",
};

// Pure formatting, split out from the query below so it's unit-testable
// without a Prisma client.
export function describeNotification(notification: {
  type: NotificationType;
  actorName: string | null;
}): string {
  return DESCRIPTION_BY_TYPE[notification.type](notification.actorName ?? "Someone");
}

function itemHref(item: { id: string; list: { id: string; workspaceId: string } }): string {
  return `/workspaces/${item.list.workspaceId}/lists/${item.list.id}/items/${item.id}`;
}

const NOTIFICATION_INCLUDE = {
  actor: { select: { name: true } },
  item: { select: { id: true, title: true, list: { select: { id: true, workspaceId: true } } } },
} as const;

// Shared row shape produced by NOTIFICATION_INCLUDE above, factored out so
// every tab-specific load function below maps a Notification row the same
// way instead of repeating this formatting (Activity, Bookmarks, Archive,
// and @Mentioned are thin filters over identical row data, #49).
function mapNotification(notification: {
  id: string;
  type: NotificationType;
  createdAt: Date;
  readAt: Date | null;
  bookmarkedAt: Date | null;
  archivedAt: Date | null;
  actor: { name: string | null } | null;
  item: { id: string; title: string; list: { id: string; workspaceId: string } };
}): ActivityNotification {
  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
    isUnread: notification.readAt === null,
    isBookmarked: notification.bookmarkedAt !== null,
    isArchived: notification.archivedAt !== null,
    actorName: notification.actor?.name ?? null,
    itemId: notification.item.id,
    itemTitle: notification.item.title,
    itemHref: itemHref(notification.item),
  };
}

// Reads are scoped by recipientId directly — a Notification row is already
// access-controlled at creation time (see notification-triggers.ts), so
// there's no separate lib/permissions/ check on the read path, matching
// lib/item/item-my-tasks.ts's userId-scoped read pattern.
export async function loadActivityNotifications(
  database: PrismaClient,
  input: { recipientId: string; category?: ActivityCategory }
): Promise<ActivityNotification[]> {
  const types = input.category ? ACTIVITY_CATEGORY_TYPES[input.category] : ACTIVITY_TYPES;

  const notifications = await database.notification.findMany({
    where: { recipientId: input.recipientId, type: { in: types }, archivedAt: null, ...NOT_DELETED_WORKSPACE_ITEM },
    include: NOTIFICATION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return notifications.map(mapNotification);
}

// Bookmarking is independent of archiving (a User can archive a bookmarked
// notification to clear it from every other tab while keeping the flag for
// when they look at Archive), but Bookmarks itself only shows notifications
// still in the active view — an archived one is found in Archive instead,
// per the "archive removes from active view" semantics in
// docs/QnA/inbox-notifications-feature-surface.md.
export async function loadBookmarkedNotifications(
  database: PrismaClient,
  input: { recipientId: string }
): Promise<ActivityNotification[]> {
  const notifications = await database.notification.findMany({
    where: {
      recipientId: input.recipientId,
      bookmarkedAt: { not: null },
      archivedAt: null,
      ...NOT_DELETED_WORKSPACE_ITEM,
    },
    include: NOTIFICATION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return notifications.map(mapNotification);
}

// Archive lists every archived notification regardless of type or category
// — it's the one tab that exists specifically to hold what the other tabs
// hide, never a delete (#49).
export async function loadArchivedNotifications(
  database: PrismaClient,
  input: { recipientId: string }
): Promise<ActivityNotification[]> {
  const notifications = await database.notification.findMany({
    where: { recipientId: input.recipientId, archivedAt: { not: null }, ...NOT_DELETED_WORKSPACE_ITEM },
    include: NOTIFICATION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return notifications.map(mapNotification);
}

// @Mentioned narrows to MENTIONED-type notifications only — the same type
// Activity's "Mentions" category chip filters to, surfaced here as its own
// top-level tab per CONTEXT.md's Updates entry.
export async function loadMentionedNotifications(
  database: PrismaClient,
  input: { recipientId: string }
): Promise<ActivityNotification[]> {
  const notifications = await database.notification.findMany({
    where: {
      recipientId: input.recipientId,
      type: { in: ACTIVITY_CATEGORY_TYPES.mentions },
      archivedAt: null,
      ...NOT_DELETED_WORKSPACE_ITEM,
    },
    include: NOTIFICATION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return notifications.map(mapNotification);
}

// Counts every unread, non-archived Notification regardless of type —
// including DUE_DATE_REMINDER, which the Activity tab above doesn't list —
// so the nav badge reflects the User's full unread count, not just what
// this ticket's tab happens to render (#47).
export async function countUnreadNotifications(database: PrismaClient, recipientId: string): Promise<number> {
  return database.notification.count({
    where: { recipientId, readAt: null, archivedAt: null, ...NOT_DELETED_WORKSPACE_ITEM },
  });
}

// Scoped to recipientId so a User can only ever mark their own
// notifications read; a no-op (not an error) if already read or the id
// doesn't belong to this recipient, keeping this action idempotent.
export async function markNotificationRead(
  database: PrismaClient,
  input: { notificationId: string; recipientId: string }
): Promise<void> {
  await database.notification.updateMany({
    where: { id: input.notificationId, recipientId: input.recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

export type ToggleNotificationBookmarkResult =
  | { status: "bookmarked" }
  | { status: "unbookmarked" }
  | { status: "not-found" };

// Scoped to recipientId, same ownership check as markNotificationRead — a
// User can only bookmark their own notifications. A toggle rather than a
// set/unset pair, matching lib/list/list-starring.ts's toggleStarred.
export async function toggleNotificationBookmark(
  database: PrismaClient,
  input: { notificationId: string; recipientId: string }
): Promise<ToggleNotificationBookmarkResult> {
  const notification = await database.notification.findFirst({
    where: { id: input.notificationId, recipientId: input.recipientId },
    select: { bookmarkedAt: true },
  });
  if (!notification) {
    return { status: "not-found" };
  }

  const isBookmarked = notification.bookmarkedAt !== null;
  await database.notification.update({
    where: { id: input.notificationId },
    data: { bookmarkedAt: isBookmarked ? null : new Date() },
  });

  return { status: isBookmarked ? "unbookmarked" : "bookmarked" };
}

// Scoped to recipientId, same ownership check as markNotificationRead.
// One-directional (archive only, no restore) — this ticket's acceptance
// criteria only calls for archiving without deleting the underlying record,
// not a restore action (#49). A no-op if already archived, keeping this
// idempotent like markNotificationRead.
export async function archiveNotification(
  database: PrismaClient,
  input: { notificationId: string; recipientId: string }
): Promise<void> {
  await database.notification.updateMany({
    where: { id: input.notificationId, recipientId: input.recipientId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
}
