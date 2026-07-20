import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import nodemailer from "nodemailer";

import { createAuth } from "@/lib/auth/auth-core";
import { loadTestServiceConfig } from "@/lib/test/test-services";
import { createMailer } from "./mailer-core";

const MAILPIT_POLL_ATTEMPTS = 20;
const MAILPIT_POLL_INTERVAL_MS = 250;
const MAILPIT_POLL_TIMEOUT_SECONDS =
  (MAILPIT_POLL_ATTEMPTS * MAILPIT_POLL_INTERVAL_MS) / 1_000;

type MailpitMessage = {
  ID?: string;
  id?: string;
  Subject?: string;
  subject?: string;
};

function mailpitMessages(body: unknown): MailpitMessage[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const messages = (body as { messages?: unknown }).messages;

  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter((candidate): candidate is MailpitMessage =>
    Boolean(candidate && typeof candidate === "object")
  );
}

function requiredEnvironmentValue(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} must be set to run the Mailpit integration test.`);
  }

  return value;
}

function messageId(message: MailpitMessage): string | null {
  return message.ID ?? message.id ?? null;
}

async function waitForMailpitMessage(
  mailpitApiUrl: string,
  subject: string
): Promise<MailpitMessage> {
  for (let attempt = 0; attempt < MAILPIT_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${mailpitApiUrl}/api/v1/messages`);
    const body: unknown = await response.json();

    const message = mailpitMessages(body).find(
      (candidate) => candidate.Subject === subject
    );

    if (message) {
      return message;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, MAILPIT_POLL_INTERVAL_MS)
    );
  }

  throw new Error(
    `Mailpit did not receive the authentication email within ${MAILPIT_POLL_TIMEOUT_SECONDS} seconds.`
  );
}

async function run() {
  const { databaseUrl, mailpitApiUrl } = loadTestServiceConfig();
  const smtpHost = requiredEnvironmentValue("MAILPIT_SMTP_HOST");
  const smtpPort = Number(requiredEnvironmentValue("MAILPIT_SMTP_PORT"));
  assert.ok(Number.isInteger(smtpPort) && smtpPort > 0);

  const recipient = `mailpit-${randomUUID()}@example.test`;
  const subject = "Confirm your email address";
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
  });
  const mailer = createMailer(
    {
      provider: "custom",
      host: smtpHost,
      port: smtpPort,
      secure: false,
      user: "",
      password: "",
      fromName: "ListItUp",
      fromEmail: "no-reply@listitup.test",
    },
    transport
  );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const auth = createAuth(prisma, mailer);

  try {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Mailpit authentication test",
          email: recipient,
          password: "a-long-test-password",
        }),
      })
    );
    assert.equal(response.status, 200);

    const message = await waitForMailpitMessage(mailpitApiUrl, subject);
    const id = messageId(message);
    assert.ok(id, "Mailpit must return an identifier for the sent message");

    const messageResponse = await fetch(
      `${mailpitApiUrl}/api/v1/message/${id}`
    );
    assert.equal(
      messageResponse.ok,
      true,
      "Mailpit must return the sent message"
    );
    const deliveredMessage = JSON.stringify(await messageResponse.json());

    assert.match(deliveredMessage, new RegExp(recipient));
    assert.match(deliveredMessage, /verify-email/);
  } finally {
    transport.close();
    await prisma.user.deleteMany({ where: { email: recipient } });
    await prisma.verificationEmailThrottle.deleteMany({
      where: { identifier: recipient },
    });
    await prisma.$disconnect();
  }

  console.log("Mailpit SMTP integration test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
