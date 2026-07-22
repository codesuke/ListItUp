import "server-only";

import { createAuth } from "@/lib/auth/auth-core";
import { createRedisEmailRequestRateLimiter } from "@/lib/auth/email-request-rate-limit";
import { createRedisProgressiveSignInRateLimiter } from "@/lib/auth/progressive-sign-in-rate-limit";
import { requestIpAddress } from "@/lib/auth/request-ip-address";
import { prisma } from "@/lib/prisma";
import { mailer } from "@/lib/mailer/mailer";
import { createDiscordAlertTransport } from "@/lib/security/discord-alerts";
import { createSecurityAlertService } from "@/lib/security/security-operations";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error(
    "REDIS_URL must be set for authentication email-request limits."
  );
}

const emailRequestRateLimiter = createRedisEmailRequestRateLimiter(redisUrl);
const discordWebhookUrl = process.env.DISCORD_SECURITY_WEBHOOK_URL;
export const securityAlertService = discordWebhookUrl
  ? createSecurityAlertService(
      prisma,
      createDiscordAlertTransport(discordWebhookUrl)
    )
  : undefined;

export const auth = createAuth(
  prisma,
  mailer,
  emailRequestRateLimiter,
  createRedisProgressiveSignInRateLimiter(redisUrl),
  securityAlertService
);

export async function canRequestAuthenticationEmail(
  email: string,
  headers: Headers
): Promise<boolean> {
  return emailRequestRateLimiter.consume(email, requestIpAddress(headers));
}
