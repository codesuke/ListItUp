import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { isListArchived } from "@/lib/list/list-visibility";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

export type ApplyLabelResult =
  | { status: "applied" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "label-not-found" }
  | { status: "label-not-in-workspace" }
  | { status: "list-archived" };

export type RemoveLabelResult =
  | { status: "removed" }
  | { status: "item-not-found" }
  | { status: "forbidden" }
  | { status: "list-archived" };

// Any List Member, Lead, or the Workspace Owner, with Item access can
// apply/remove a Label — not gated by Label-creation rights (#34).
const REQUIRED_ACCESS_LEVEL = "WRITE";

export async function applyLabel(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; labelId: string }
): Promise<ApplyLabelResult> {
  const { actorUserId, itemId, labelId } = input;

  const item = await database.item.findUnique({ where: { id: itemId }, include: { list: true } });
  if (!item) {
    return { status: "item-not-found" };
  }

  if (isListArchived(item.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveItemAccess(database, { userId: actorUserId, itemId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const label = await database.label.findUnique({ where: { id: labelId } });
  if (!label) {
    return { status: "label-not-found" };
  }
  if (label.workspaceId !== item.list.workspaceId) {
    return { status: "label-not-in-workspace" };
  }

  await database.itemLabel.upsert({
    where: { itemId_labelId: { itemId, labelId } },
    create: { id: randomUUID(), itemId, labelId },
    update: {},
  });

  return { status: "applied" };
}

export async function removeLabel(
  database: PrismaClient,
  input: { actorUserId: string; itemId: string; labelId: string }
): Promise<RemoveLabelResult> {
  const { actorUserId, itemId, labelId } = input;

  const item = await database.item.findUnique({
    where: { id: itemId },
    include: { list: { select: { archivedAt: true } } },
  });
  if (!item) {
    return { status: "item-not-found" };
  }

  if (isListArchived(item.list)) {
    return { status: "list-archived" };
  }

  const access = await resolveItemAccess(database, { userId: actorUserId, itemId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.itemLabel.deleteMany({ where: { itemId, labelId } });
  return { status: "removed" };
}
