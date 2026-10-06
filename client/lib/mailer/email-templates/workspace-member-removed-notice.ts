import { renderEmailTemplate, type EmailTemplate } from "./render";

export interface WorkspaceMemberRemovedNoticeEmailParams {
  workspaceName: string;
  actorName: string;
}

export function workspaceMemberRemovedNoticeEmail(
  params: WorkspaceMemberRemovedNoticeEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `You were removed from ${params.workspaceName}`,
    previewText: `${params.actorName} removed you from ${params.workspaceName}.`,
    heading: `You were removed from ${params.workspaceName}`,
    paragraphs: [
      `${params.actorName} removed you from the ${params.workspaceName} Workspace on ListItUp. You no longer have access to it or any of its Lists.`,
    ],
  });
}
