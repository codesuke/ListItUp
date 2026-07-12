import {
  renderEmailTemplate,
  SECURITY_NOTICE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export type RecoveryCodeNoticeReason = "regenerated" | "invalidated";

export interface RecoveryCodeNoticeEmailParams {
  reason: RecoveryCodeNoticeReason;
}

export function recoveryCodeNoticeEmail(
  params: RecoveryCodeNoticeEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `Your recovery codes were ${params.reason}`,
    previewText: `Your ListItUp recovery codes were ${params.reason}.`,
    heading: `Recovery codes ${params.reason}`,
    paragraphs: [
      `Your previous recovery codes were ${params.reason} on your ListItUp account.`,
    ],
    footerNote: SECURITY_NOTICE_FOOTER_NOTE,
  });
}
