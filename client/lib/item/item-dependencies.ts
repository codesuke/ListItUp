import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { resolveItemAccess } from "@/lib/permissions/item-access";
import { meetsListAccessLevel } from "@/lib/permissions/list-access";

export type CreateDependencyResult =
  | { status: "created" }
  | { status: "self-dependency" }
  | { status: "blocker-not-found" }
  | { status: "blocked-not-found" }
  | { status: "forbidden" }
  | { status: "duplicate" };

export type RemoveDependencyResult =
  | { status: "removed" }
  | { status: "dependency-not-found" }
  | { status: "forbidden" };

// A List Member, Lead, or the Workspace Owner, with access to BOTH Items
// can create/remove a Dependency between them, including across different
// Lists (#35). Purely informational: neither function ever touches
// either Item's state.
const REQUIRED_ACCESS_LEVEL = "WRITE";

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

async function hasWriteAccessToBoth(
  database: PrismaClient,
  actorUserId: string,
  itemIdA: string,
  itemIdB: string
): Promise<boolean> {
  const [accessA, accessB] = await Promise.all([
    resolveItemAccess(database, { userId: actorUserId, itemId: itemIdA }),
    resolveItemAccess(database, { userId: actorUserId, itemId: itemIdB }),
  ]);
  return meetsListAccessLevel(accessA, REQUIRED_ACCESS_LEVEL) && meetsListAccessLevel(accessB, REQUIRED_ACCESS_LEVEL);
}

export async function createDependency(
  database: PrismaClient,
  input: { actorUserId: string; blockerId: string; blockedId: string }
): Promise<CreateDependencyResult> {
  const { actorUserId, blockerId, blockedId } = input;

  if (blockerId === blockedId) {
    return { status: "self-dependency" };
  }

  const [blocker, blocked] = await Promise.all([
    database.item.findUnique({ where: { id: blockerId } }),
    database.item.findUnique({ where: { id: blockedId } }),
  ]);
  if (!blocker) {
    return { status: "blocker-not-found" };
  }
  if (!blocked) {
    return { status: "blocked-not-found" };
  }

  if (!(await hasWriteAccessToBoth(database, actorUserId, blockerId, blockedId))) {
    return { status: "forbidden" };
  }

  try {
    await database.itemDependency.create({ data: { id: randomUUID(), blockerId, blockedId } });
    return { status: "created" };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate" };
    }
    throw error;
  }
}

export async function removeDependency(
  database: PrismaClient,
  input: { actorUserId: string; blockerId: string; blockedId: string }
): Promise<RemoveDependencyResult> {
  const { actorUserId, blockerId, blockedId } = input;

  const dependency = await database.itemDependency.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (!dependency) {
    return { status: "dependency-not-found" };
  }

  if (!(await hasWriteAccessToBoth(database, actorUserId, blockerId, blockedId))) {
    return { status: "forbidden" };
  }

  await database.itemDependency.delete({ where: { id: dependency.id } });
  return { status: "removed" };
}
