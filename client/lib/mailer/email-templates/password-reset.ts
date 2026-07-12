import {
  renderEmailTemplate,
  GENERIC_IGNORE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export interface PasswordResetEmailParams {
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetEmail(
  params: PasswordResetEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: "Reset your password",
    previewText: "Use this link to reset your ListItUp password.",
    heading: "Reset your password",
    paragraphs: [
      "Click the button below to choose a new password.",
      `This link expires in ${params.expiresInMinutes} minutes and can only be used once.`,
    ],
    action: { label: "Reset password", url: params.resetUrl },
    footerNote: GENERIC_IGNORE_FOOTER_NOTE,
  });
}
