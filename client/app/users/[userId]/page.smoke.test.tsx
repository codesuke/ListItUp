import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadUserProfilePlaceholderData } from "./page-data";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("user profile placeholder smoke test skipped: DATABASE_URL is not set");
    return;
  }

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const createdUserIds: string[] = [];

  try {
    // Any signed-in Viewer can load another User's name/avatar for the
    // placeholder — unlike /profile, this is never scoped to the session's
    // own user id.
    {
      const userId = randomUUID();
      createdUserIds.push(userId);
      await prisma.user.create({
        data: {
          id: userId,
          name: "Jordan Pike",
          email: `user-profile-${userId}@example.test`,
          image: "https://example.test/avatar.png",
        },
      });

      const data = await loadUserProfilePlaceholderData(prisma, userId);

      assert.ok(data, "expected placeholder data for an existing User");
      assert.equal(data!.name, "Jordan Pike");
      assert.equal(data!.image, "https://example.test/avatar.png");
    }

    // A User id that does not resolve to a real User gets no page data
    // (the state page.tsx treats as notFound()).
    {
      const data = await loadUserProfilePlaceholderData(prisma, randomUUID());
      assert.equal(data, null);
    }
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log("user profile placeholder smoke test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
