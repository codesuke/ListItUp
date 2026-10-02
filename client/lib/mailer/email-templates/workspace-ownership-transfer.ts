import {
  renderEmailTemplate,
  SECURITY_NOTICE_FOOTER_NOTE,
  type EmailTemplate,
} from "./render";

export interface WorkspaceOwnershipTransferEmailParams {
  workspaceName: string;
  counterpartyName: string;
}

export function workspaceOwnershipTransferredToNewOwnerEmail(
  params: WorkspaceOwnershipTransferEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `You're now the Owner of ${params.workspaceName}`,
    previewText: `Ownership of ${params.workspaceName} was transferred to you.`,
    heading: `You're the new Owner of ${params.workspaceName}`,
    paragraphs: [
      `${params.counterpartyName} transferred ownership of the ${params.workspaceName} Workspace to you on ListItUp.`,
      "You now have full control over this Workspace, including its members and settings.",
    ],
  });
}

export function workspaceOwnershipTransferredFromPreviousOwnerEmail(
  params: WorkspaceOwnershipTransferEmailParams
): EmailTemplate {
  return renderEmailTemplate({
    subject: `You transferred ownership of ${params.workspaceName}`,
    previewText: `Ownership of ${params.workspaceName} was transferred to ${params.counterpartyName}.`,
    heading: "Ownership transferred",
    paragraphs: [
      `You transferred ownership of the ${params.workspaceName} Workspace to ${params.counterpartyName}.`,
    ],
    footerNote: SECURITY_NOTICE_FOOTER_NOTE,
  });
}
