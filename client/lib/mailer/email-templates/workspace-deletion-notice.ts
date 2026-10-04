import { renderEmailTemplate, type EmailTemplate } from "./render";

function formatRestoreDeadline(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export interface WorkspaceDeletedNoticeEmailParams {
  workspaceName: string;
  deletedByName: string;
  restoreDeadline: Date;
}

export function workspaceDeletedNoticeEmail(
  params: WorkspaceDeletedNoticeEmailParams
): EmailTemplate {
  const deadline = formatRestoreDeadline(params.restoreDeadline);

  return renderEmailTemplate({
    subject: `${params.workspaceName} was deleted`,
    previewText: `${params.deletedByName} deleted the ${params.workspaceName} Workspace.`,
    heading: `${params.workspaceName} was deleted`,
    paragraphs: [
      `${params.deletedByName} deleted the ${params.workspaceName} Workspace on ListItUp. You no longer have access to it.`,
      `${params.deletedByName} can restore it until ${deadline}. After that, it and its data are permanently removed.`,
    ],
  });
}

export interface WorkspaceRestoredNoticeEmailParams {
  workspaceName: string;
}

export function workspaceRestoredNoticeEmail(
  params: WorkspaceRestoredNoticeEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `${params.workspaceName} was restored`,
    previewText: `Your access to ${params.workspaceName} is back.`,
    heading: `${params.workspaceName} was restored`,
    paragraphs: [
      `The ${params.workspaceName} Workspace on ListItUp was restored. Your access is back.`,
    ],
  });
}
