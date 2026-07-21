import { createHash } from "node:crypto";

import { createClient } from "redis";

const RECIPIENT_MINUTE_LIMIT = 1;
const RECIPIENT_HOUR_LIMIT = 5;
const RECIPIENT_DAY_LIMIT = 10;
const IP_HOUR_LIMIT = 20;
const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

const CONSUME_EMAIL_REQUEST_LIMITS = `
  for index, key in ipairs(KEYS) do
    local limit = tonumber(ARGV[(index - 1) * 2 + 1])
    if tonumber(redis.call('GET', key) or '0') >= limit then
      return 0
    end
  end

  for index, key in ipairs(KEYS) do
    local count = redis.call('INCR', key)
    if count == 1 then
      redis.call('EXPIRE', key, tonumber(ARGV[(index - 1) * 2 + 2]))
    end
  end

  return 1
`;

export interface EmailRequestRateLimiter {
  consume(recipient: string, ipAddress: string): Promise<boolean>;
  close?(): Promise<void>;
}

export const GENERIC_EMAIL_REQUEST_LIMIT_MESSAGE =
  "If the email can receive this request, a message is on its way. Please try again later.";

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requestLimitKeys(recipient: string, ipAddress: string): string[] {
  const recipientFingerprint = fingerprint(recipient);
  const ipFingerprint = fingerprint(ipAddress);

  return [
    `auth:email-request:${recipientFingerprint}:minute`,
    `auth:email-request:${recipientFingerprint}:hour`,
    `auth:email-request:${recipientFingerprint}:day`,
    `auth:email-request-ip:${ipFingerprint}:hour`,
  ];
}

export function createRedisEmailRequestRateLimiter(redisUrl: string): EmailRequestRateLimiter {
  const client = createClient({ url: redisUrl });
  let connection: Promise<unknown> | undefined;

  client.on("error", (error) => {
    console.error("[auth] Redis email-request limiter error", error);
  });

  async function connect(): Promise<void> {
    connection ??= client.connect();
    await connection;
  }

  return {
    async consume(recipient, ipAddress) {
      await connect();
      const result = await client.eval(CONSUME_EMAIL_REQUEST_LIMITS, {
        keys: requestLimitKeys(recipient, ipAddress),
        arguments: [
          String(RECIPIENT_MINUTE_LIMIT),
          String(MINUTE_IN_SECONDS),
          String(RECIPIENT_HOUR_LIMIT),
          String(HOUR_IN_SECONDS),
          String(RECIPIENT_DAY_LIMIT),
          String(DAY_IN_SECONDS),
          String(IP_HOUR_LIMIT),
          String(HOUR_IN_SECONDS),
        ],
      });

      return result === 1;
    },
    async close() {
      if (client.isOpen) {
        await client.close();
      }
    },
  };
}
