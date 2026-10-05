import type { PrismaClient } from "@/generated/prisma/client";
import { lockAndCountSoleLeadLists } from "@/lib/list/list-membership";

export type DeleteAccountResult =
  | { status: "deleted" }
  | { status: "sole-lead-block"; count: number };

// Reuses lockAndCountSoleLeadLists' lock-then-count (see list-membership.ts
// for why) with no workspaceId filter, so deletion doesn't rely on the
// cascade that deletes the User's ListMember rows and can't strand a List
// in any Workspace the User belongs to, not just one (List Lead Rules
// spec, #100).
export async function deleteAccount(
  database: PrismaClient,
  input: { userId: string }
): Promise<DeleteAccountResult> {
  const { userId } = input;

  return database.$transaction(async (tx) => {
    const soleLeadListCount = await lockAndCountSoleLeadLists(tx, { userId });
    if (soleLeadListCount > 0) {
      return { status: "sole-lead-block", count: soleLeadListCount };
    }

    await tx.user.delete({ where: { id: userId } });
    return { status: "deleted" };
  });
}
