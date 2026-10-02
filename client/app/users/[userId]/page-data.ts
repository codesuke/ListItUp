import type { PrismaClient } from "@/generated/prisma/client";

export type UserProfilePlaceholderData = {
  name: string;
  image: string | null;
};

// A real cross-User profile page doesn't exist yet (/profile only ever
// renders the session's own user) — this backs the "coming soon"
// placeholder the global Search palette's Member results link to (#56,
// #70, ADR 0015). Kept separate from page.tsx for the same smoke-testing
// reason as app/profile/page-data.ts.
export async function loadUserProfilePlaceholderData(
  database: PrismaClient,
  targetUserId: string
): Promise<UserProfilePlaceholderData | null> {
  const user = await database.user.findUnique({
    where: { id: targetUserId },
    select: { name: true, image: true },
  });

  return user;
}
