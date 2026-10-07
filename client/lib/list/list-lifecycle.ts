import type { ListStatus, PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

const LIST_STATUSES: readonly ListStatus[] = ["ON_TRACK", "ON_HOLD", "COMPLETED", "DROPPED"];

export function isValidListStatus(value: string): value is ListStatus {
  return (LIST_STATUSES as readonly string[]).includes(value);
}

export type ArchiveListResult =
  | { status: "archived" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "already-archived" };

export type RestoreListResult =
  | { status: "restored" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "not-archived" };

export type SetListStatusResult =
  | { status: "updated" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "invalid-status" }
  | { status: "list-archived" };

export type UpdateListDescriptionResult =
  | { status: "updated" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

// A List Lead or the Workspace Owner (implicit Lead-equivalent access) can
// Archive/Restore/set Status/edit Description (#26, #27). A Workspace
// Admin has no implicit access (ADR 0016) unless explicitly given a List
// role.
const REQUIRED_ACCESS_LEVEL = "LEAD";

export async function archiveList(
  database: PrismaClient,
  input: { userId: string; listId: string }
): Promise<ArchiveListResult> {
  const list = await database.list.findUnique({ where: { id: input.listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, input);
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  if (isListArchived(list)) {
    return { status: "already-archived" };
  }

  await database.list.update({ where: { id: input.listId }, data: { archivedAt: new Date() } });
  return { status: "archived" };
}

export async function restoreList(
  database: PrismaClient,
  input: { userId: string; listId: string }
): Promise<RestoreListResult> {
  const list = await database.list.findUnique({ where: { id: input.listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, input);
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  if (!isListArchived(list)) {
    return { status: "not-archived" };
  }

  await database.list.update({ where: { id: input.listId }, data: { archivedAt: null } });
  return { status: "restored" };
}

export async function setListStatus(
  database: PrismaClient,
  input: { userId: string; listId: string; status: string }
): Promise<SetListStatusResult> {
  if (!isValidListStatus(input.status)) {
    return { status: "invalid-status" };
  }

  const list = await database.list.findUnique({ where: { id: input.listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  if (isListArchived(list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, {
    userId: input.userId,
    listId: input.listId,
  });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.list.update({ where: { id: input.listId }, data: { status: input.status } });
  return { status: "updated" };
}

export async function updateListDescription(
  database: PrismaClient,
  input: { userId: string; listId: string; description: string }
): Promise<UpdateListDescriptionResult> {
  const list = await database.list.findUnique({ where: { id: input.listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  if (isListArchived(list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, {
    userId: input.userId,
    listId: input.listId,
  });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const description = input.description.trim();
  await database.list.update({
    where: { id: input.listId },
    data: { description: description || null },
  });
  return { status: "updated" };
}
