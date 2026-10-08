import type { PrismaClient } from "@/generated/prisma/client";
import { applyLabel } from "@/lib/item/item-labels";
import { createItem } from "@/lib/item/item-creation";
import { parseQuickAdd } from "@/lib/item/quick-add-parser";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";
import { ACTIVE_WORKSPACE_WHERE } from "@/lib/workspace/workspace-visibility";

export type CreateItemFromQuickAddResult =
  | { status: "created"; itemId: string }
  | { status: "empty-title" }
  | { status: "no-inbox-list" }
  | { status: "no-writable-list" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type QuickAddMentionCandidate = { id: string; name: string };

// Suggestions for Quick-Add's `@name` autocomplete: every teammate across
// every Workspace the User belongs to, deduped by User. The target List
// (and therefore which single Workspace an `@name` must actually resolve
// within, per resolveAssigneeUserIds below) isn't known until the typed
// shorthand is parsed at submit time, so suggestions can't be scoped any
// narrower than "everyone the User could plausibly mean" up front.
export async function loadQuickAddMentionCandidates(
  database: PrismaClient,
  userId: string
): Promise<QuickAddMentionCandidate[]> {
  const ownMemberships = await database.workspaceMember.findMany({
    where: { userId, workspace: ACTIVE_WORKSPACE_WHERE },
    select: { workspaceId: true },
  });
  const workspaceIds = ownMemberships.map((membership) => membership.workspaceId);
  if (workspaceIds.length === 0) {
    return [];
  }

  const members = await database.workspaceMember.findMany({
    where: { workspaceId: { in: workspaceIds } },
    orderBy: { id: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });

  const candidateById = new Map<string, QuickAddMentionCandidate>();
  for (const member of members) {
    candidateById.set(member.user.id, { id: member.user.id, name: member.user.name });
  }
  return [...candidateById.values()];
}

// The Personal Space Workspace is the only Workspace auto-provisioned with
// an Inbox List (lib/workspace/workspace-provisioning.ts) — "the User's
// Inbox List" (#45) means that List, not a per-Workspace concept.
async function findInboxListId(database: PrismaClient, userId: string): Promise<string | null> {
  const inboxList = await database.list.findFirst({
    where: { isInbox: true, workspace: { kind: "PERSONAL", ...ACTIVE_WORKSPACE_WHERE, members: { some: { userId } } } },
    select: { id: true },
  });
  return inboxList?.id ?? null;
}

// Quick-Add's fallback when no `~list` shorthand was typed: the My Tasks
// "Workspace" filter (not "All Workspaces") is the User's stated context,
// so an unscoped capture belongs in that Workspace, not always the
// Personal Space Inbox — landing it somewhere the User wasn't even
// looking at defeats the point of filtering. There's no "default List"
// concept for a shared Workspace the way Personal Space has an Inbox, so
// this picks the Workspace's oldest List the User can write to, skipping
// archived Lists since those are hidden from the Workspace's normal views.
async function resolveWorkspaceDefaultListId(
  database: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<string | null> {
  const candidates = await database.list.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const candidate of candidates) {
    const access = await resolveListAccess(database, { userId, listId: candidate.id });
    if (meetsListAccessLevel(access, "WRITE")) {
      return candidate.id;
    }
  }

  return null;
}

// Falls back to the scoped Workspace's own default List when My Tasks is
// filtered to one; otherwise the Personal Space Inbox, same as before the
// Workspace filter was threaded through at all.
async function resolveFallbackListId(
  database: PrismaClient,
  userId: string,
  scopedWorkspaceId: string | undefined
): Promise<string | null> {
  if (scopedWorkspaceId) {
    return resolveWorkspaceDefaultListId(database, userId, scopedWorkspaceId);
  }
  return findInboxListId(database, userId);
}

// Matches Quick-Add's `~list` shorthand against Lists the User can write
// to, case-insensitively. Candidates are scoped to Workspaces the User
// belongs to and checked in a stable order so ties resolve
// deterministically.
async function resolveNamedListId(
  database: PrismaClient,
  userId: string,
  listName: string
): Promise<string | null> {
  const candidates = await database.list.findMany({
    where: { name: { equals: listName, mode: "insensitive" }, workspace: { members: { some: { userId } } } },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  for (const candidate of candidates) {
    const access = await resolveListAccess(database, { userId, listId: candidate.id });
    if (meetsListAccessLevel(access, "WRITE")) {
      return candidate.id;
    }
  }

  return null;
}

// Labels unresolved by name are silently dropped rather than created —
// Label creation is gated to Workspace Owner/Admin (lib/list/list-labels.ts,
// #34) and Quick-Add typing a Label name isn't meant to grant that.
async function resolveLabelIds(database: PrismaClient, workspaceId: string, labelNames: string[]): Promise<string[]> {
  if (labelNames.length === 0) {
    return [];
  }

  const labels = await database.label.findMany({ where: { workspaceId } });
  const labelIdByLowerName = new Map(labels.map((label) => [label.name.toLowerCase(), label.id]));

  return labelNames
    .map((name) => labelIdByLowerName.get(name.toLowerCase()))
    .filter((labelId): labelId is string => labelId !== undefined);
}

// Assignees unresolved by name, or not a member of the target List's
// Workspace, are silently dropped. A Quick-Add `@name` token can't contain
// whitespace, but User.name is a free-text display name (no username
// field exists) and often does — e.g. "Jane Doe" — so matching is against
// the first word of that display name, case-insensitively. Display names
// aren't unique, so the first Workspace-membership match wins —
// resolveNamedListId's ordering pattern, applied the same way here.
async function resolveAssigneeUserIds(
  database: PrismaClient,
  workspaceId: string,
  assigneeNames: string[]
): Promise<string[]> {
  if (assigneeNames.length === 0) {
    return [];
  }

  const members = await database.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { id: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });

  const userIdByLowerFirstName = new Map<string, string>();
  for (const member of members) {
    const lowerFirstName = member.user.name.split(/\s+/)[0]?.toLowerCase();
    if (lowerFirstName && !userIdByLowerFirstName.has(lowerFirstName)) {
      userIdByLowerFirstName.set(lowerFirstName, member.user.id);
    }
  }

  const resolvedUserIds = assigneeNames
    .map((name) => userIdByLowerFirstName.get(name.toLowerCase()))
    .filter((userId): userId is string => userId !== undefined);

  return [...new Set(resolvedUserIds)];
}

// Quick-Add's single entry point (#45): parses shorthand out of typed
// text, resolves it against real List/Label/User rows, and creates the
// Item through lib/item/'s existing createItem — never a parallel
// creation path.
export async function createItemFromQuickAdd(
  database: PrismaClient,
  input: { actorUserId: string; text: string; now?: Date; scopedWorkspaceId?: string }
): Promise<CreateItemFromQuickAddResult> {
  const { actorUserId, text, now, scopedWorkspaceId } = input;
  const parsed = parseQuickAdd(text, now);

  if (parsed.title.length === 0) {
    return { status: "empty-title" };
  }

  const listId = parsed.listName
    ? ((await resolveNamedListId(database, actorUserId, parsed.listName)) ??
      (await resolveFallbackListId(database, actorUserId, scopedWorkspaceId)))
    : await resolveFallbackListId(database, actorUserId, scopedWorkspaceId);

  if (!listId) {
    return scopedWorkspaceId ? { status: "no-writable-list" } : { status: "no-inbox-list" };
  }

  const list = await database.list.findUniqueOrThrow({ where: { id: listId }, select: { workspaceId: true } });
  const resolvedAssigneeUserIds = await resolveAssigneeUserIds(database, list.workspaceId, parsed.assigneeNames);
  // My Tasks (this capture box's home) lists Items by ItemAssignee, not by
  // Creator — an Item typed here with no `@assignee` shorthand defaults to
  // the actor themselves so it actually shows up where it was captured,
  // rather than silently landing only in the target List (#45).
  const assigneeUserIds = resolvedAssigneeUserIds.length > 0 ? resolvedAssigneeUserIds : [actorUserId];

  const result = await createItem(database, {
    actorUserId,
    listId,
    title: parsed.title,
    dueDate: parsed.dueDate ?? undefined,
    assigneeUserIds,
  });

  if (result.status !== "created") {
    switch (result.status) {
      case "list-not-found":
        return { status: "list-not-found" };
      case "forbidden":
        return { status: "forbidden" };
      case "list-archived":
        return { status: "list-archived" };
      case "parent-not-found":
      case "parent-not-in-list":
        // Unreachable: parentId is never passed to createItem above.
        return { status: "forbidden" };
    }
  }

  const labelIds = await resolveLabelIds(database, list.workspaceId, parsed.labelNames);
  for (const labelId of labelIds) {
    await applyLabel(database, { actorUserId, itemId: result.itemId, labelId });
  }

  return { status: "created", itemId: result.itemId };
}
