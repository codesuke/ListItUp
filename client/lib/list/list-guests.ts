import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { meetsListAccessLevel, resolveListAccess } from "@/lib/permissions/list-access";

export type GrantGuestAccessResult =
  | { status: "granted" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "user-not-found" };

export type RevokeGuestAccessResult =
  | { status: "revoked" }
  | { status: "list-not-found" }
  | { status: "forbidden" };

// A List Lead or the Workspace Owner (implicit Lead-equivalent access) can
// grant/revoke Guest access (#28). A Workspace Admin has no implicit
// access (ADR 0016) unless explicitly given a List role.
const REQUIRED_ACCESS_LEVEL = "LEAD";

// Guest access is granted by email rather than userId: a Guest is, by
// definition, a person without any Workspace-level relationship the caller
// could otherwise look up (ADR 0009) — they must already have a ListItUp
// account, but inviting a brand-new account is out of this ticket's scope.
export async function grantGuestAccess(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; email: string }
): Promise<GrantGuestAccessResult> {
  const { actorUserId, listId, email } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  const targetUser = await database.user.findUnique({ where: { email } });
  if (!targetUser) {
    return { status: "user-not-found" };
  }

  await database.guest.upsert({
    where: { listId_userId: { listId, userId: targetUser.id } },
    create: { id: randomUUID(), listId, userId: targetUser.id },
    update: {},
  });

  return { status: "granted" };
}

export async function revokeGuestAccess(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; userId: string }
): Promise<RevokeGuestAccessResult> {
  const { actorUserId, listId, userId } = input;

  const list = await database.list.findUnique({ where: { id: listId } });
  if (!list) {
    return { status: "list-not-found" };
  }

  const access = await resolveListAccess(database, { userId: actorUserId, listId });
  if (!meetsListAccessLevel(access, REQUIRED_ACCESS_LEVEL)) {
    return { status: "forbidden" };
  }

  await database.guest.deleteMany({ where: { listId, userId } });
  return { status: "revoked" };
}
