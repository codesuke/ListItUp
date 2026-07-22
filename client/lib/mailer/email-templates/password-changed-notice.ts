import {
  renderEmailTemplate,
  SECURITY_NOTICE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export function passwordChangedNoticeEmail(): EmailTemplate {
  return renderEmailTemplate({
    subject: "Your password was changed",
    previewText: "Your ListItUp password was just changed.",
    heading: "Password changed",
    paragraphs: ["Your ListItUp password was just changed."],
    footerNote: SECURITY_NOTICE_FOOTER_NOTE,
  });
}
