import { renderEmailTemplate, type EmailTemplate } from "./render";

function formatPurgeDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export interface WorkspacePurgeWarningEmailParams {
  workspaceName: string;
  purgeDate: Date;
}

export function workspacePurgeWarningEmail(
  params: WorkspacePurgeWarningEmailParams
): EmailTemplate {
  const purgeDate = formatPurgeDate(params.purgeDate);

  return renderEmailTemplate({
    subject: `${params.workspaceName} will be permanently deleted soon`,
    previewText: `The Restore Window for ${params.workspaceName} ends on ${purgeDate}.`,
    heading: `${params.workspaceName}'s Restore Window is ending soon`,
    paragraphs: [
      `The ${params.workspaceName} Workspace on ListItUp is still deleted and its Restore Window ends on ${purgeDate}.`,
      `Restore it before then if you want to keep it. After ${purgeDate} it and its data, including attachment files, are permanently removed and cannot be recovered.`,
    ],
  });
}
