"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  archiveNotification,
  markNotificationRead,
  toggleNotificationBookmark,
} from "@/lib/notification/notification-inbox";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

const UPDATES_PATH = "/updates";

// Opening a notification marks it read, then sends the User to what it
// refers to — the badge's unread count is derived fresh on next render, so
// no separate revalidation call is needed once redirect() navigates away.
export async function openNotificationAction(notificationId: string, subjectHref: string): Promise<void> {
  const session = await requireAuthenticatedSession(UPDATES_PATH);
  await markNotificationRead(prisma, { notificationId, recipientId: session.user.id });
  redirect(subjectHref);
}

// Toggling a bookmark stays on the current tab (no redirect), so the UI
// needs an explicit revalidation for the row's new state — and for
// Bookmarks itself, where unbookmarking should drop the row from the list.
export async function toggleBookmarkAction(notificationId: string): Promise<void> {
  const session = await requireAuthenticatedSession(UPDATES_PATH);
  await toggleNotificationBookmark(prisma, { notificationId, recipientId: session.user.id });
  revalidatePath(UPDATES_PATH);
}

// Archiving stays on the current tab too — the row disappears from
// Activity/Bookmarks/@Mentioned and becomes visible in Archive on the next
// render of whichever tab the User navigates to.
export async function archiveNotificationAction(notificationId: string): Promise<void> {
  const session = await requireAuthenticatedSession(UPDATES_PATH);
  await archiveNotification(prisma, { notificationId, recipientId: session.user.id });
  revalidatePath(UPDATES_PATH);
}
