import type { WorkspaceRole } from "@/generated/prisma/client";
import { WORKSPACE_ROLE_LABEL } from "@/lib/workspace/workspace-member-roles";

import { renderEmailTemplate, type EmailTemplate } from "./render";

export interface WorkspaceRoleChangedNoticeEmailParams {
  workspaceName: string;
  actorName: string;
  newRole: WorkspaceRole;
}

export function workspaceRoleChangedNoticeEmail(
  params: WorkspaceRoleChangedNoticeEmailParams
): EmailTemplate {
  const roleLabel = WORKSPACE_ROLE_LABEL[params.newRole];

  return renderEmailTemplate({
    subject: `Your role in ${params.workspaceName} changed to ${roleLabel}`,
    previewText: `${params.actorName} made you ${roleLabel} in ${params.workspaceName}.`,
    heading: `You're now ${roleLabel} in ${params.workspaceName}`,
    paragraphs: [
      `${params.actorName} changed your role in the ${params.workspaceName} Workspace on ListItUp to ${roleLabel}.`,
    ],
  });
}
