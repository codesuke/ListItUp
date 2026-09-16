// Bootstraps a demo account and a rich demo workspace so a human can sign
// in and click through every wired screen (Home, My Tasks, List View, List
// Dashboard counts/breakdown, Updates' four tabs, Notification
// preferences) without creating any data by hand first.
//
// Idempotent at two levels: reuses an existing User for the given email
// instead of erroring, and skips workspace seeding entirely if the target
// User already owns a Workspace named DEMO_WORKSPACE_NAME.
//
// Usage: pnpm exec tsx scripts/seed-demo-data.ts <email> [password]
// Omit password to have one generated and printed at the end.

import { randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/auth-config";
import { provisionPersonalWorkspace } from "@/lib/workspace/workspace-provisioning";
import { DEMO_WORKSPACE_NAME, provisionDemoWorkspace } from "@/lib/workspace/demo-workspace";

function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm exec tsx scripts/seed-demo-data.ts <email> [password]");
    process.exit(1);
  }

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("@/generated/prisma/client"),
  ]);
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    let owner = await database.user.findUnique({ where: { email } });
    let generatedPassword: string | null = null;

    if (!owner) {
      const suppliedPassword = process.argv[3];
      const password = suppliedPassword ?? generatePassword();
      if (password.length < MIN_PASSWORD_LENGTH) {
        console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        process.exit(1);
      }
      if (!suppliedPassword) {
        generatedPassword = password;
      }

      owner = await database.user.create({
        data: {
          id: randomUUID(),
          name: email.split("@")[0],
          email,
          emailVerified: true,
          accounts: {
            create: [
              {
                id: randomUUID(),
                accountId: randomUUID(),
                providerId: "credential",
                password: await hashPassword(password),
              },
            ],
          },
        },
      });

      await provisionPersonalWorkspace(database, owner.id);
      console.log(`Created account for ${email}.`);
    } else if (!owner.emailVerified) {
      owner = await database.user.update({ where: { id: owner.id }, data: { emailVerified: true } });
      await provisionPersonalWorkspace(database, owner.id);
    }

    const result = await provisionDemoWorkspace(database, owner.id);
    if (result === "already_provisioned") {
      console.log(`"${DEMO_WORKSPACE_NAME}" already exists for ${email} — skipping, nothing to do.`);
    } else {
      console.log(`Seeded "${DEMO_WORKSPACE_NAME}" for ${email}.`);
    }
    if (generatedPassword) {
      console.log(`Sign in with ${email} / ${generatedPassword}`);
    }
  } finally {
    await database.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
