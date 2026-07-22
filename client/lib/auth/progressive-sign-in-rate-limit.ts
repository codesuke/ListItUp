import { createHash } from "node:crypto";

import { createClient } from "redis";

const FAILURES_PER_WINDOW = 5;
const FAILURE_WINDOW_SECONDS = 15 * 60;
const INITIAL_RESTRICTION_SECONDS = FAILURE_WINDOW_SECONDS;
const ESCALATED_RESTRICTION_SECONDS = 24 * 60 * 60;
const ESCALATION_TRACKING_SECONDS = ESCALATED_RESTRICTION_SECONDS;
const DAILY_WARNING_FAILURES = 10;
const DAILY_WARNING_SECONDS = 24 * 60 * 60;

const IS_RESTRICTED = `
  for _, key in ipairs(KEYS) do
    if tonumber(redis.call('TTL', key)) > 0 then
      return 1
    end
  end
  return 0
`;

const RECORD_FAILURE = `
  local restrictionKeys = { KEYS[1], KEYS[2] }
  local failureKeys = { KEYS[3], KEYS[4] }
  local escalationKeys = { KEYS[5], KEYS[6] }
  local dailyFailureKey = KEYS[7]
  local dailyWarningKey = KEYS[8]
  local shouldWarn = 0
  local shouldAlertEscalation = 0

  for index, failureKey in ipairs(failureKeys) do
    local count = redis.call('INCR', failureKey)
    if count == 1 then
      redis.call('EXPIRE', failureKey, tonumber(ARGV[1]))
    end

    if count >= tonumber(ARGV[2]) then
      local escalationCount = redis.call('INCR', escalationKeys[index])
      if escalationCount == 1 then
        redis.call('EXPIRE', escalationKeys[index], tonumber(ARGV[3]))
      end

      local restrictionSeconds = tonumber(ARGV[4])
      if escalationCount > 1 then
        restrictionSeconds = tonumber(ARGV[5])
        shouldAlertEscalation = 1
      end
      redis.call('SET', restrictionKeys[index], '1', 'EX', restrictionSeconds)
      redis.call('DEL', failureKey)
    end
  end

  if ARGV[6] == '1' then
    local dailyFailures = redis.call('INCR', dailyFailureKey)
    if dailyFailures == 1 then
      redis.call('EXPIRE', dailyFailureKey, tonumber(ARGV[7]))
    end
    if dailyFailures >= tonumber(ARGV[8]) and redis.call('SET', dailyWarningKey, '1', 'NX', 'EX', tonumber(ARGV[7])) then
      shouldWarn = 1
    end
  end

  return shouldWarn + (shouldAlertEscalation * 2)
`;

export type SignInFailureKind = "password" | "two-factor";

export interface RecordSignInFailure {
  identity: string;
  ipAddress: string;
  kind: SignInFailureKind;
  verifiedUser?: boolean;
}

export interface ProgressiveSignInRateLimiter {
  isRestricted(identity: string, ipAddress: string): Promise<boolean>;
  recordFailure(
    failure: RecordSignInFailure
  ): Promise<{ shouldWarn: boolean; shouldAlertEscalation: boolean }>;
  close?(): Promise<void>;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function dimensionKeys(identity: string, ipAddress: string) {
  const identityFingerprint = fingerprint(identity);
  const ipFingerprint = fingerprint(ipAddress);

  return {
    restriction: [
      `auth:sign-in:restriction:identity:${identityFingerprint}`,
      `auth:sign-in:restriction:ip:${ipFingerprint}`,
    ],
    failure: [
      `auth:sign-in:failure:identity:${identityFingerprint}`,
      `auth:sign-in:failure:ip:${ipFingerprint}`,
    ],
    escalation: [
      `auth:sign-in:escalation:identity:${identityFingerprint}`,
      `auth:sign-in:escalation:ip:${ipFingerprint}`,
    ],
    dailyFailure: `auth:sign-in:daily-password-failure:${identityFingerprint}`,
    dailyWarning: `auth:sign-in:daily-password-warning:${identityFingerprint}`,
  };
}

export function createRedisProgressiveSignInRateLimiter(
  redisUrl: string
): ProgressiveSignInRateLimiter {
  const client = createClient({ url: redisUrl });
  let connection: Promise<unknown> | undefined;

  client.on("error", (error) => {
    console.error("[auth] Redis progressive sign-in limiter error", error);
  });

  async function connect(): Promise<void> {
    connection ??= client.connect();
    await connection;
  }

  return {
    async isRestricted(identity, ipAddress) {
      await connect();
      const keys = dimensionKeys(identity, ipAddress);
      const result = await client.eval(IS_RESTRICTED, {
        keys: keys.restriction,
      });

      return result === 1;
    },
    async recordFailure(failure) {
      await connect();
      const keys = dimensionKeys(failure.identity, failure.ipAddress);
      const result = await client.eval(RECORD_FAILURE, {
        keys: [
          ...keys.restriction,
          ...keys.failure,
          ...keys.escalation,
          keys.dailyFailure,
          keys.dailyWarning,
        ],
        arguments: [
          String(FAILURE_WINDOW_SECONDS),
          String(FAILURES_PER_WINDOW),
          String(ESCALATION_TRACKING_SECONDS),
          String(INITIAL_RESTRICTION_SECONDS),
          String(ESCALATED_RESTRICTION_SECONDS),
          failure.kind === "password" && failure.verifiedUser ? "1" : "0",
          String(DAILY_WARNING_SECONDS),
          String(DAILY_WARNING_FAILURES),
        ],
      });

      const signal = typeof result === "number" ? result : 0;
      return {
        shouldWarn: signal % 2 === 1,
        shouldAlertEscalation: signal >= 2,
      };
    },
    async close() {
      if (client.isOpen) {
        await client.close();
      }
    },
  };
}
