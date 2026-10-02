import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { InviteMemberForm } from "./InviteMemberForm";
import { loadWorkspaceMembersPageData } from "./page-data";
import { ResendInvitationButton } from "./ResendInvitationButton";

const ROLE_LABEL = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
} as const;

function formatExpiry(expiresAt: Date): string {
  return expiresAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceMembersPage({ params }: Props) {
  const { workspaceId } = await params;
  const session = await requireAuthenticatedSession(
    `/workspaces/${workspaceId}/settings/members`
  );

  const data = await loadWorkspaceMembersPageData(prisma, session.user.id, workspaceId);

  if (!data) {
    notFound();
  }

  const { workspaceName, members, canManageInvitations, pendingInvitations } = data;

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink animate-in fade-in duration-200">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// " + workspaceName}
          </span>
        </div>

        <h1 className="text-3xl font-light text-ink">Members</h1>

        <ul className="mt-10 flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-4 border border-surface-3 bg-surface-1/95 px-4 py-3"
            >
              <div className="min-w-0 truncate text-sm text-ink">
                {member.name}
                {member.userId === session.user.id ? (
                  <span className="text-ink-faint"> (you)</span>
                ) : null}
              </div>
              <span className="shrink-0 border border-line-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {ROLE_LABEL[member.role]}
              </span>
            </li>
          ))}
        </ul>

        {canManageInvitations ? (
          <>
            <section className="mt-10 border-t border-surface-3 pt-10">
              <h2 className="mb-4 text-lg font-light text-ink">Invite someone</h2>
              <InviteMemberForm workspaceId={workspaceId} />
            </section>

            <section className="mt-10 border-t border-surface-3 pt-10">
              <h2 className="mb-4 text-lg font-light text-ink">Pending Invitations</h2>
              {pendingInvitations.length === 0 ? (
                <p className="text-sm text-ink-muted">No Pending Invitations.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendingInvitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center justify-between gap-4 border border-surface-3 bg-surface-1/95 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{invitation.email}</div>
                        <div className="truncate text-xs text-ink-faint">
                          Invited by {invitation.invitedByName ?? "a former member"} &middot;{" "}
                          {invitation.isExpired
                            ? "Expired"
                            : `Expires ${formatExpiry(invitation.expiresAt)}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="border border-line-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                          {ROLE_LABEL[invitation.role]}
                        </span>
                        <ResendInvitationButton
                          workspaceId={workspaceId}
                          invitationId={invitation.id}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
