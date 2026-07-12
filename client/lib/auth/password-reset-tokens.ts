import type { PrismaClient } from "@/generated/prisma/client";

const RESET_TOKEN_IDENTIFIER_PREFIX = "reset-password:";

// Better Auth does not invalidate a User's prior reset link when a new one
// is requested. Its reset tokens are stored with `identifier:
// "reset-password:<token>"` and `value: <userId>`, so the prior link for the
// same User can be found and removed directly.
export async function invalidateOtherPasswordResetTokens(
  database: PrismaClient,
  userId: string,
  currentToken: string
): Promise<void> {
  await database.verification.deleteMany({
    where: {
      identifier: {
        startsWith: RESET_TOKEN_IDENTIFIER_PREFIX,
        not: `${RESET_TOKEN_IDENTIFIER_PREFIX}${currentToken}`,
      },
      value: userId,
    },
  });
}
