import { renderEmailTemplate, type EmailTemplate } from "./render";

export interface WorkspaceInvitationEmailParams {
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
  expiresInDays: number;
}

export function workspaceInvitationEmail(
  params: WorkspaceInvitationEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `${params.inviterName} invited you to ${params.workspaceName} on ListItUp`,
    previewText: `Join ${params.workspaceName} on ListItUp.`,
    heading: `Join ${params.workspaceName}`,
    paragraphs: [
      `${params.inviterName} invited you to collaborate in the ${params.workspaceName} Workspace on ListItUp.`,
      `This invitation expires in ${params.expiresInDays} days.`,
    ],
    action: { label: "Accept invitation", url: params.inviteUrl },
    footerNote:
      "If you weren't expecting this invitation, you can ignore this email.",
  });
}
