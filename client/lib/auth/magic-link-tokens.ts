import type { PrismaClient } from "@/generated/prisma/client";

// The magic-link plugin does not invalidate a User's prior link when a new
// one is requested, and it stores the token itself (not the email) as the
// Verification row's identifier — so the only way to find "other pending
// magic links for this email" is to match the JSON payload it stores in
// `value` (`JSON.stringify({ email, name })`).
export async function invalidateOtherMagicLinkTokens(
  database: PrismaClient,
  email: string,
  currentToken: string
): Promise<void> {
  await database.verification.deleteMany({
    where: {
      identifier: { not: currentToken },
      value: { contains: `"email":"${email}"` },
    },
  });
}
