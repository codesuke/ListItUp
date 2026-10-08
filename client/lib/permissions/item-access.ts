import type { PrismaClient } from "@/generated/prisma/client";
import { resolveListAccess, type ListAccessLevel } from "./list-access";

// Item-level access always derives from the Item's parent List's effective
// access (#23) — never an independent WorkspaceMember/ListMember
// query, so the single resolution order in list-access.ts stays the one
// place that logic lives.
export async function resolveItemAccess(
  database: PrismaClient,
  input: { userId: string; itemId: string }
): Promise<ListAccessLevel> {
  const item = await database.item.findUnique({
    where: { id: input.itemId },
    select: { listId: true },
  });

  if (!item) {
    return "NONE";
  }

  return resolveListAccess(database, { userId: input.userId, listId: item.listId });
}
