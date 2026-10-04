import type { ListMemberRole, PrismaClient } from "@/generated/prisma/client";
import { grantGuestAccess } from "@/lib/list/list-guests";
import { addListMember } from "@/lib/list/list-membership";

export type ListAccessByEmailRole = ListMemberRole | "GUEST";

export type AddListAccessByEmailResult =
  | { status: "added" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "user-not-found" }
  | { status: "user-lacks-workspace-membership" };

// The Manage Access panel's email field (#28) grants List Member/Viewer or
// Guest access from one input with an explicit role choice, instead of
// always defaulting to Guest. A Guest grant reuses grantGuestAccess's own
// email lookup directly; Member/Viewer first resolve the email to a User
// and then reuse addListMember, which itself enforces ADR 0009's rule that
// only an existing Workspace member can hold a List-level role — an email
// with no Workspace membership can only ever become a Guest here.
export async function addListAccessByEmail(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; email: string; role: ListAccessByEmailRole }
): Promise<AddListAccessByEmailResult> {
  const { actorUserId, listId, email, role } = input;

  if (role === "GUEST") {
    const result = await grantGuestAccess(database, { actorUserId, listId, email });
    return result.status === "granted" ? { status: "added" } : result;
  }

  const targetUser = await database.user.findUnique({ where: { email } });
  if (!targetUser) {
    return { status: "user-not-found" };
  }

  return addListMember(database, { actorUserId, listId, userId: targetUser.id, role });
}
