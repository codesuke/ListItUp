// One-off (and safely re-runnable) backfill: provisions a Demo Workspace
// for every verified User who doesn't already own one, for existing
// accounts that signed up before Demo Workspace provisioning was added to
// the sign-in flow (lib/auth/auth-core.ts). New sign-ins get one
// automatically and never need this script.
//
// Usage: pnpm exec tsx scripts/backfill-demo-workspaces.ts

import { provisionDemoWorkspace } from "@/lib/workspace/demo-workspace";
import { provisionPersonalWorkspace } from "@/lib/workspace/workspace-provisioning";

async function main() {
  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const users = await database.user.findMany({
      where: { emailVerified: true },
      select: { id: true, email: true },
    });

    let created = 0;
    let adopted = 0;
    let alreadyProvisioned = 0;

    for (const user of users) {
      // A verified User is guaranteed a Personal Space on their next
      // sign-in, but this backfill runs outside that flow — provision it
      // here too so provisionDemoWorkspace's Personal Space Inbox items
      // have somewhere to land.
      await provisionPersonalWorkspace(database, user.id);

      const result = await provisionDemoWorkspace(database, user.id);
      if (result === "created") {
        created += 1;
        console.log(`Created Demo Workspace for ${user.email}.`);
      } else if (result === "adopted") {
        adopted += 1;
        console.log(`Adopted existing "Product Launch" Workspace as the Demo Workspace for ${user.email}.`);
      } else {
        alreadyProvisioned += 1;
      }
    }

    console.log(
      `Done: ${created} created, ${adopted} adopted, ${alreadyProvisioned} already had one (${users.length} verified User(s) checked).`
    );
  } finally {
    await database.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
