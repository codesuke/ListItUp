import {
  renderEmailTemplate,
  SECURITY_NOTICE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export type TwoFactorNoticeAction = "enabled" | "disabled";

export interface TwoFactorNoticeEmailParams {
  action: TwoFactorNoticeAction;
}

export function twoFactorNoticeEmail(
  params: TwoFactorNoticeEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `Two-factor authentication was ${params.action}`,
    previewText: `Two-factor authentication was just ${params.action} on your account.`,
    heading: `Two-factor authentication ${params.action}`,
    paragraphs: [
      `Two-factor authentication was just ${params.action} on your ListItUp account.`,
    ],
    footerNote: SECURITY_NOTICE_FOOTER_NOTE,
  });
}
