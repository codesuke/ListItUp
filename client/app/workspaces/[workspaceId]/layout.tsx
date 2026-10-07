import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";
import { resolveWorkspaceLayoutRedirectTarget } from "@/lib/workspace/workspace-layout-access";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}`);

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: true },
  });

  // No membership row means this User doesn't belong here any more — most
  // often someone removed from the Workspace (#91) following a stale link
  // or the removal notice email — so they're sent to a Workspace they
  // still belong to rather than a dead end (see
  // resolveWorkspaceLayoutRedirectTarget). A Workspace that still exists
  // but is soft-deleted (#74) stays a genuine 404: who was removed from it
  // doesn't change that it's frozen.
  if (!membership) {
    const defaultWorkspaceId = await resolveDefaultWorkspaceId(prisma, session.user.id);
    redirect(resolveWorkspaceLayoutRedirectTarget(defaultWorkspaceId));
  }

  if (membership.workspace.deletedAt) {
    notFound();
  }

  return (
    <AppShell
      currentWorkspaceId={workspaceId}
      currentWorkspaceName={membership.workspace.name}
      userId={session.user.id}
    >
      {children}
    </AppShell>
  );
}
