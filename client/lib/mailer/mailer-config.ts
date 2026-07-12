import "server-only";

export type MailProvider = "google" | "mailgun" | "brevo" | "custom";

const KNOWN_PROVIDERS: readonly MailProvider[] = [
  "google",
  "mailgun",
  "brevo",
  "custom",
];

export interface MailerConfig {
  provider: MailProvider;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function isMailProvider(value: string): value is MailProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(value);
}

function parseProvider(env: NodeJS.ProcessEnv): MailProvider {
  const value = env.MAIL_PROVIDER ?? "custom";

  if (!isMailProvider(value)) {
    throw new Error(
      `Invalid MAIL_PROVIDER "${value}": expected one of ${KNOWN_PROVIDERS.join(", ")}`
    );
  }

  return value;
}

function parsePort(env: NodeJS.ProcessEnv): number {
  const raw = requireEnv(env, "SMTP_PORT");
  const port = Number(raw);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid SMTP_PORT "${raw}": expected a positive integer`);
  }

  return port;
}

export function loadMailerConfig(
  env: NodeJS.ProcessEnv = process.env
): MailerConfig {
  return {
    provider: parseProvider(env),
    host: requireEnv(env, "SMTP_HOST"),
    port: parsePort(env),
    secure: env.SMTP_SECURE === "true",
    user: requireEnv(env, "SMTP_USER"),
    password: requireEnv(env, "SMTP_PASSWORD"),
    fromName: requireEnv(env, "MAIL_FROM_NAME"),
    fromEmail: requireEnv(env, "MAIL_FROM_EMAIL"),
  };
}
