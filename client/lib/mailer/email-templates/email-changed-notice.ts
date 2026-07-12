import {
  renderEmailTemplate,
  SECURITY_NOTICE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export interface EmailChangedNoticeEmailParams {
  newEmail: string;
}

export function emailChangedNoticeEmail(
  params: EmailChangedNoticeEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: "Your email address was changed",
    previewText: `Your ListItUp email address was changed to ${params.newEmail}.`,
    heading: "Email address changed",
    paragraphs: [
      `Your ListItUp account email address was changed to ${params.newEmail}.`,
    ],
    footerNote: SECURITY_NOTICE_FOOTER_NOTE,
  });
}
