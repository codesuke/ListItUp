import type { PrismaClient } from "@/generated/prisma/client";

export type ListRoleEntry = { userId: string; name: string };

export type ListRoles = {
  leads: ListRoleEntry[];
  members: ListRoleEntry[];
  viewers: ListRoleEntry[];
};

// Read-only Roles list for a List's Overview tab (#27): who has List Lead,
// Member, and Viewer access. Managing these roles is #28's concern.
export async function getListRoles(
  database: PrismaClient,
  input: { listId: string }
): Promise<ListRoles> {
  const members = await database.listMember.findMany({
    where: { listId: input.listId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const toEntry = (row: { userId: string; user: { name: string } }): ListRoleEntry => ({
    userId: row.userId,
    name: row.user.name,
  });

  return {
    leads: members.filter((m) => m.role === "LEAD").map(toEntry),
    members: members.filter((m) => m.role === "MEMBER").map(toEntry),
    viewers: members.filter((m) => m.role === "VIEWER").map(toEntry),
  };
}
