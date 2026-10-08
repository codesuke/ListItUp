import type { ListMemberRole, PrismaClient } from "@/generated/prisma/client";
import { addListMember } from "@/lib/list/list-membership";

export type AddListAccessByEmailResult =
  | { status: "added" }
  | { status: "list-not-found" }
  | { status: "forbidden" }
  | { status: "user-not-found" }
  | { status: "user-lacks-workspace-membership" }
  | { status: "viewer-ceiling" }
  | { status: "list-archived" };

// The Manage Access panel's email field (#28) grants List Member/Viewer
// access from one input with an explicit role choice. The email is resolved
// to a User and then handed to addListMember, which itself enforces ADR
// 0009's rule that only an existing Workspace member can hold a List-level
// role.
export async function addListAccessByEmail(
  database: PrismaClient,
  input: { actorUserId: string; listId: string; email: string; role: ListMemberRole }
): Promise<AddListAccessByEmailResult> {
  const { actorUserId, listId, email, role } = input;

  const targetUser = await database.user.findUnique({ where: { email } });
  if (!targetUser) {
    return { status: "user-not-found" };
  }

  return addListMember(database, { actorUserId, listId, userId: targetUser.id, role });
}
