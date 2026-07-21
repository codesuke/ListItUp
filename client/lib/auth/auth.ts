import "server-only";

import { createAuth } from "@/lib/auth/auth-core";
import { createRedisEmailRequestRateLimiter } from "@/lib/auth/email-request-rate-limit";
import { prisma } from "@/lib/prisma";
import { mailer } from "@/lib/mailer/mailer";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL must be set for authentication email-request limits.");
}

export const auth = createAuth(
  prisma,
  mailer,
  createRedisEmailRequestRateLimiter(redisUrl)
);
