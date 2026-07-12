import { renderEmailTemplate, type EmailTemplate } from "./render";

export interface VerificationEmailParams {
  verifyUrl: string;
  expiresInHours: number;
}

export function verificationEmail(
  params: VerificationEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: "Confirm your email address",
    previewText: "Confirm your email to finish setting up ListItUp.",
    heading: "Confirm your email address",
    paragraphs: [
      "Click the button below to confirm your email address and finish setting up your ListItUp account.",
      `This link expires in ${params.expiresInHours} hours.`,
    ],
    action: { label: "Confirm email", url: params.verifyUrl },
    footerNote:
      "If you didn't create a ListItUp account, you can ignore this email.",
  });
}
