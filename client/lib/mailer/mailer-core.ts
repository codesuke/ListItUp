import type { MailerConfig } from "@/lib/mailer/mailer-config";
import type { EmailTemplate } from "@/lib/mailer/email-templates/render";

export type EmailMessageType =
  | "verification"
  | "magic-link"
  | "password-reset"
  | "email-change"
  | "email-changed-notice"
  | "two-factor-notice"
  | "recovery-code-notice"
  | "workspace-invitation";

export interface TransportMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailTransport {
  sendMail(message: TransportMessage): Promise<unknown>;
}

export interface SendEmailInput {
  to: string;
  type: EmailMessageType;
  template: EmailTemplate;
}

export type SendEmailResult =
  { ok: true } | { ok: false; reason: "send-failed" };

export interface Mailer {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export function createMailer(
  config: MailerConfig,
  transport: MailTransport
): Mailer {
  return {
    async send(input) {
      try {
        await transport.sendMail({
          from: `"${config.fromName}" <${config.fromEmail}>`,
          to: input.to,
          subject: input.template.subject,
          html: input.template.html,
          text: input.template.text,
        });

        return { ok: true };
      } catch (error) {
        console.error("[mailer] send failed", {
          type: input.type,
          provider: config.provider,
          error: error instanceof Error ? error.message : String(error),
        });

        return { ok: false, reason: "send-failed" };
      }
    },
  };
}
