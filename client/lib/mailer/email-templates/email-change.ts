import { renderEmailTemplate, type EmailTemplate } from "./render";

export interface EmailChangeEmailParams {
  confirmUrl: string;
  newEmail: string;
  expiresInHours: number;
}

export function emailChangeEmail(
  params: EmailChangeEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: "Confirm your new email address",
    previewText: "Confirm this email address to complete the change.",
    heading: "Confirm your new email address",
    paragraphs: [
      `Click the button below to confirm ${params.newEmail} as your new ListItUp email address.`,
      `This link expires in ${params.expiresInHours} hours.`,
    ],
    action: { label: "Confirm new email", url: params.confirmUrl },
    footerNote: "If you didn't request this change, you can ignore this email.",
  });
}
