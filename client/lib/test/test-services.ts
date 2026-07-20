import { createConnection } from "node:net";

import { Client } from "pg";

const DEFAULT_REDIS_PORT = 6379;
const REDIS_CONNECTION_TIMEOUT_MS = 5_000;

export interface TestServiceConfig {
  databaseUrl: string;
  redisUrl: string;
  mailpitApiUrl: string;
}

type Environment = Record<string, string | undefined>;

function requireEnvironmentValue(
  environment: Environment,
  key: string
): string {
  const value = environment[key];

  if (!value) {
    throw new Error(`${key} must be set to run the behavior suite.`);
  }

  return value;
}

function normalizeUrl(value: string, key: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${key} must be a valid URL for the behavior suite.`);
  }
}

export function loadTestServiceConfig(
  environment: Environment = process.env
): TestServiceConfig {
  return {
    databaseUrl: requireEnvironmentValue(environment, "DATABASE_URL"),
    redisUrl: requireEnvironmentValue(environment, "REDIS_URL"),
    mailpitApiUrl: normalizeUrl(
      requireEnvironmentValue(environment, "MAILPIT_API_URL"),
      "MAILPIT_API_URL"
    ),
  };
}

async function verifyPostgres(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query("SELECT 1");
  } finally {
    await client.end();
  }
}

async function verifyRedis(redisUrl: string): Promise<void> {
  const url = new URL(redisUrl);
  const port = Number(url.port || DEFAULT_REDIS_PORT);

  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port });

    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(REDIS_CONNECTION_TIMEOUT_MS, () => {
      fail(
        new Error(
          `Redis did not respond within ${REDIS_CONNECTION_TIMEOUT_MS / 1_000} seconds.`
        )
      );
    });
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.write("PING\r\n");
    });
    socket.once("data", (response: Buffer) => {
      socket.end();

      if (response.toString().startsWith("+PONG")) {
        resolve();
        return;
      }

      reject(new Error("Redis did not accept the PING command."));
    });
  });
}

async function verifyMailpit(mailpitApiUrl: string): Promise<void> {
  const response = await fetch(`${mailpitApiUrl}/api/v1/messages`);

  if (!response.ok) {
    throw new Error(`Mailpit returned HTTP ${response.status}.`);
  }
}

export async function verifyTestServices(
  config: TestServiceConfig
): Promise<void> {
  try {
    await Promise.all([
      verifyPostgres(config.databaseUrl),
      verifyRedis(config.redisUrl),
      verifyMailpit(config.mailpitApiUrl),
    ]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `The behavior suite requires reachable PostgreSQL, Redis, and Mailpit services. ${reason}`
    );
  }
}
