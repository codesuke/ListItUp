export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailContent {
  subject: string;
  previewText: string;
  heading: string;
  paragraphs: string[];
  action?: EmailAction;
  footerNote?: string;
}

export interface EmailTemplate {
  subject: string;
  previewText: string;
  html: string;
  text: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const EMAIL_COLORS = {
  primary: "#FF6B4A",
  background: "#E5E5E0",
  surface: "#ffffff",
  border: "#333333",
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  onPrimary: "#ffffff",
} as const;

export const GENERIC_IGNORE_FOOTER_NOTE =
  "If you didn't request this, you can ignore this email.";

export const SECURITY_NOTICE_FOOTER_NOTE =
  "If you didn't make this change, secure your account and contact support immediately.";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function renderHtml(content: EmailContent): string {
  const paragraphsHtml = content.paragraphs
    .map(
      (paragraph) => `<p style="margin: 0 0 16px;">${escapeHtml(paragraph)}</p>`
    )
    .join("\n    ");

  const actionHtml = content.action
    ? `<p style="margin: 24px 0;">
      <a href="${escapeHtml(content.action.url)}" style="display: inline-block; background: ${EMAIL_COLORS.primary}; color: ${EMAIL_COLORS.onPrimary}; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">${escapeHtml(content.action.label)}</a>
    </p>`
    : "";

  const footerHtml = content.footerNote
    ? `<p style="margin: 24px 0 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 12px;">${escapeHtml(content.footerNote)}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin: 0; background: ${EMAIL_COLORS.background}; font-family: Inter, Arial, sans-serif; color: ${EMAIL_COLORS.textPrimary};">
    <span style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(content.previewText)}</span>
    <table role="presentation" width="100%" style="padding: 32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" style="background: ${EMAIL_COLORS.surface}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 32px;">
            <tr>
              <td>
                <p style="margin: 0 0 24px; font-weight: 600; color: ${EMAIL_COLORS.primary};">ListItUp</p>
                <h1 style="margin: 0 0 16px; font-size: 20px;">${escapeHtml(content.heading)}</h1>
                ${paragraphsHtml}
                ${actionHtml}
                ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(content: EmailContent): string {
  const lines = [content.heading, "", ...content.paragraphs];

  if (content.action) {
    lines.push("", `${content.action.label}: ${content.action.url}`);
  }

  if (content.footerNote) {
    lines.push("", content.footerNote);
  }

  return lines.join("\n");
}

export function renderEmailTemplate(content: EmailContent): EmailTemplate {
  return {
    subject: content.subject,
    previewText: content.previewText,
    html: renderHtml(content),
    text: renderText(content),
  };
}
