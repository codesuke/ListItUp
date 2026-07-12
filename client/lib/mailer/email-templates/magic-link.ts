import {
  renderEmailTemplate,
  GENERIC_IGNORE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export interface MagicLinkEmailParams {
  magicLinkUrl: string;
  expiresInMinutes: number;
}

export function magicLinkEmail(params: MagicLinkEmailParams): EmailTemplate {
  return renderEmailTemplate({
    subject: "Your ListItUp sign-in link",
    previewText: "Use this link to sign in to ListItUp.",
    heading: "Sign in to ListItUp",
    paragraphs: [
      "Click the button below to sign in. No password needed.",
      `This link expires in ${params.expiresInMinutes} minutes and can only be used once.`,
    ],
    action: { label: "Sign in", url: params.magicLinkUrl },
    footerNote: GENERIC_IGNORE_FOOTER_NOTE,
  });
}
