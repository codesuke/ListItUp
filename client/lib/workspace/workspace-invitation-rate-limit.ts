import { createClient } from "redis";

const INVITER_HOUR_LIMIT = 10;
const INVITER_DAY_LIMIT = 30;
const WORKSPACE_HOUR_LIMIT = 20;
const WORKSPACE_DAY_LIMIT = 50;
const HOUR_IN_SECONDS = 60 * 60;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

const CONSUME_INVITATION_SEND_LIMITS = `
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

export interface WorkspaceInvitationRateLimiter {
  consume(inviterId: string, workspaceId: string): Promise<boolean>;
  close?(): Promise<void>;
}

export const GENERIC_INVITATION_RATE_LIMIT_MESSAGE =
  "You've sent a lot of invitations recently. Please try again later.";

function sendLimitKeys(inviterId: string, workspaceId: string): string[] {
  return [
    `workspace-invitation:inviter:${inviterId}:hour`,
    `workspace-invitation:inviter:${inviterId}:day`,
    `workspace-invitation:workspace:${workspaceId}:hour`,
    `workspace-invitation:workspace:${workspaceId}:day`,
  ];
}

export function createRedisWorkspaceInvitationRateLimiter(
  redisUrl: string
): WorkspaceInvitationRateLimiter {
  const client = createClient({ url: redisUrl });
  let connection: Promise<unknown> | undefined;

  client.on("error", (error) => {
    console.error("[workspace] Redis invitation rate limiter error", error);
  });

  async function connect(): Promise<void> {
    connection ??= client.connect();
    await connection;
  }

  return {
    async consume(inviterId, workspaceId) {
      await connect();
      const result = await client.eval(CONSUME_INVITATION_SEND_LIMITS, {
        keys: sendLimitKeys(inviterId, workspaceId),
        arguments: [
          String(INVITER_HOUR_LIMIT),
          String(HOUR_IN_SECONDS),
          String(INVITER_DAY_LIMIT),
          String(DAY_IN_SECONDS),
          String(WORKSPACE_HOUR_LIMIT),
          String(HOUR_IN_SECONDS),
          String(WORKSPACE_DAY_LIMIT),
          String(DAY_IN_SECONDS),
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
