import { randomBytes, randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { PASSWORD_RESET_EXPIRES_IN_MINUTES } from "@/lib/auth/auth-config";
import { invalidateOtherPasswordResetTokens } from "@/lib/auth/password-reset-tokens";
import type { Mailer } from "@/lib/mailer/mailer-core";
import { passwordResetEmail } from "@/lib/mailer/email-templates/password-reset";

const RESET_TOKEN_PREFIX = "reset-password:";

export async function requestPasswordResetEmail(
  database: PrismaClient,
  mailer: Mailer,
  email: string
): Promise<"sent" | "unknown" | "failed"> {
  const user = await database.user.findUnique({ where: { email } });
  if (!user) return "unknown";

  const token = randomBytes(24).toString("base64url");
  const verificationId = randomUUID();
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRES_IN_MINUTES * 60_000
  );
  await database.verification.create({
    data: {
      id: verificationId,
      identifier: `${RESET_TOKEN_PREFIX}${token}`,
      value: user.id,
      expiresAt,
    },
  });

  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL must be set.");
  const resetUrl = `${baseUrl}/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password")}`;
  const result = await mailer.send({
    to: user.email,
    type: "password-reset",
    template: passwordResetEmail({
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
    }),
  });
  if (!result.ok) {
    await database.verification.delete({ where: { id: verificationId } });
    return "failed";
  }

  await invalidateOtherPasswordResetTokens(database, user.id, token);
  return "sent";
}
