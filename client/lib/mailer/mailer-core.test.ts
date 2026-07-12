import assert from "node:assert/strict";

import { createMailer, type MailTransport } from "@/lib/mailer/mailer-core";
import type { MailerConfig } from "./mailer-config";
import { verificationEmail } from "./email-templates/verification";

const config: MailerConfig = {
  provider: "mailgun",
  host: "smtp.mailgun.test",
  port: 587,
  secure: false,
  user: "postmaster@listitup.test",
  password: "test-password",
  fromName: "ListItUp",
  fromEmail: "no-reply@listitup.test",
};

const template = verificationEmail({
  verifyUrl: "https://listitup.test/verify-email?token=abc",
  expiresInHours: 24,
});

async function testSendSuccessPassesRenderedTemplateToTransport() {
  const calls: unknown[] = [];
  const transport: MailTransport = {
    async sendMail(message) {
      calls.push(message);
    },
  };

  const mailer = createMailer(config, transport);
  const result = await mailer.send({
    to: "user@listitup.test",
    type: "verification",
    template,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    from: '"ListItUp" <no-reply@listitup.test>',
    to: "user@listitup.test",
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function testSendFailureReturnsGenericRetryableResultAndLogs() {
  const transport: MailTransport = {
    async sendMail() {
      throw new Error("mailgun rejected the message");
    },
  };

  const loggedCalls: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    loggedCalls.push(args);
  };

  try {
    const mailer = createMailer(config, transport);
    const result = await mailer.send({
      to: "user@listitup.test",
      type: "verification",
      template,
    });

    assert.deepEqual(result, { ok: false, reason: "send-failed" });
    assert.equal(loggedCalls.length, 1);

    const [, logPayload] = loggedCalls[0] as [string, Record<string, unknown>];
    assert.equal(logPayload.type, "verification");
    assert.equal(logPayload.provider, "mailgun");
    assert.equal(logPayload.error, "mailgun rejected the message");
  } finally {
    console.error = originalConsoleError;
  }
}

async function run() {
  await testSendSuccessPassesRenderedTemplateToTransport();
  await testSendFailureReturnsGenericRetryableResultAndLogs();
  console.log("mailer core test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
