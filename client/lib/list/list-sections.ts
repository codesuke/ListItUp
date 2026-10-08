import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type CreateSectionResult =
  | { status: "created"; sectionId: string }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type RenameSectionResult =
  | { status: "renamed" }
  | { status: "section-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type DuplicateSectionResult =
  | { status: "duplicated"; sectionId: string }
  | { status: "section-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type DeleteSectionResult =
  | { status: "deleted" }
  | { status: "section-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

export type ReorderSectionsResult =
  | { status: "reordered" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "invalid-order" }
  | { status: "list-archived" };

export type SetListGroupByResult =
  | { status: "updated" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "invalid-group-by" };

// A List Lead, List Member, or the Workspace Owner can manage Sections
// and the List view's grouping (#29) — a List Viewer cannot.
const REQUIRED_ACCESS_LEVEL = "WRITE";

// Only "SECTION" is groupable today. This expands once Item's schema ships
// (#30) and fields like state/Assignee become real groupable columns —
// kept as a validated string rather than a native enum for exactly that
// reason (see the List.groupBy schema comment).
const VALID_GROUP_BY_VALUES: readonly string[] = ["SECTION"];

export function isValidGroupBy(value: string): boolean {
  return VALID_GROUP_BY_VALUES.includes(value);
}

export function computeNextSectionOrder(currentMaxOrder: number | null): number {
  return (currentMaxOrder ?? -1) + 1;
}

// A reorder payload is valid only if it's an exact permutation of the
// List's existing Section ids — no drops, no additions, no duplicates.
export function isValidSectionReorder(existingIds: string[], proposedIds: string[]): boolean {
  if (existingIds.length !== proposedIds.length) {
    return false;
  }

  const existingSet = new Set(existingIds);
  const seen = new Set<string>();

  for (const id of proposedIds) {
    if (!existingSet.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
  }

  return true;
}

async function nextOrderFor(database: PrismaClient, listId: string): Promise<number> {
  const { _max } = await database.section.aggregate({ where: { listId }, _max: { order: true } });
  return computeNextSectionOrder(_max.order);
}

export async function createSection(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; name: string }
): Promise<CreateSectionResult> {
  const { actorUserId, listId, name } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  if (isListArchived(list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const order = await nextOrderFor(database, listId);
  const section = await database.section.create({
    data: { id: randomUUID(), listId, name, order },
  });

  return { status: "created", sectionId: section.id };
}

export async function renameSection(
  database: PrismaClient,
  input: { actorUserId: string; sectionId: string; name: string }
): Promise<RenameSectionResult> {
  const { actorUserId, sectionId, name } = input;

  const section = await database.section.findUnique({
    where: { id: sectionId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!section) {
    return { status: "section-not-found" };
  }

  if (isListArchived(section.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId: section.listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.section.update({ where: { id: sectionId }, data: { name } });
  return { status: "renamed" };
}

export async function duplicateSection(
  database: PrismaClient,
  input: { actorUserId: string; sectionId: string }
): Promise<DuplicateSectionResult> {
  const { actorUserId, sectionId } = input;

  const section = await database.section.findUnique({
    where: { id: sectionId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!section) {
    return { status: "section-not-found" };
  }

  if (isListArchived(section.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId: section.listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const order = await nextOrderFor(database, section.listId);
  const copy = await database.section.create({
    data: { id: randomUUID(), listId: section.listId, name: `${section.name} (copy)`, order },
  });

  return { status: "duplicated", sectionId: copy.id };
}

export async function deleteSection(
  database: PrismaClient,
  input: { actorUserId: string; sectionId: string }
): Promise<DeleteSectionResult> {
  const { actorUserId, sectionId } = input;

  const section = await database.section.findUnique({
    where: { id: sectionId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!section) {
    return { status: "section-not-found" };
  }

  if (isListArchived(section.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId: section.listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.section.delete({ where: { id: sectionId } });
  return { status: "deleted" };
}

export async function reorderSections(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; orderedSectionIds: string[] }
): Promise<ReorderSectionsResult> {
  const { actorUserId, listId, orderedSectionIds } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  if (isListArchived(list)) {
    return { status: "list-archived" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const existingSections = await database.section.findMany({ where: { listId }, select: { id: true } });
  if (!isValidSectionReorder(existingSections.map((s) => s.id), orderedSectionIds)) {
    return { status: "invalid-order" };
  }

  await Promise.all(
    orderedSectionIds.map((sectionId, order) =>
      database.section.update({ where: { id: sectionId }, data: { order } })
    )
  );

  return { status: "reordered" };
}

export async function setListGroupBy(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; groupBy: string }
): Promise<SetListGroupByResult> {
  const { actorUserId, listId, groupBy } = input;

  if (!isValidGroupBy(groupBy)) {
    return { status: "invalid-group-by" };
  }

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.list.update({ where: { id: listId }, data: { groupBy } });
  return { status: "updated" };
}
