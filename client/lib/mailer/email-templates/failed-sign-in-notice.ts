import {
  renderEmailTemplate,
  SECURITY_NOTICE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export function failedSignInNoticeEmail(): EmailTemplate {
  return renderEmailTemplate({
    subject: "We noticed repeated sign-in attempts",
    previewText: "ListItUp temporarily restricted repeated sign-in attempts.",
    heading: "Repeated sign-in attempts",
    paragraphs: [
      "We temporarily restricted repeated attempts to sign in to your ListItUp account.",
      "If this was not you, consider changing your password.",
    ],
    footerNote: SECURITY_NOTICE_FOOTER_NOTE,
  });
}
