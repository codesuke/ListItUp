import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { loadWorkspaceSettingsPageData } from "./page-data";
import { TransferOwnershipForm } from "./TransferOwnershipForm";

const ROLE_LABEL = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
} as const;

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const session = await requireAuthenticatedSession(`/workspaces/${workspaceId}/settings`);

  const data = await loadWorkspaceSettingsPageData(prisma, session.user.id, workspaceId);

  if (!data) {
    notFound();
  }

  const { workspaceName, viewerRole, members } = data;
  const transferCandidates = members
    .filter((member) => member.userId !== session.user.id)
    .map((member) => ({ userId: member.userId, name: member.name, email: member.email }));

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink animate-in fade-in duration-200">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// " + workspaceName}
          </span>
        </div>

        <h1 className="text-3xl font-light text-ink">Workspace settings</h1>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-light text-ink">General</h2>
          <div className="group">
            <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              Workspace name
            </span>
            <div className="flex h-11 items-center border border-surface-3 bg-surface-1/95 px-4 text-sm text-ink">
              {workspaceName}
            </div>
          </div>
        </section>

        <section className="mt-10 border-t border-surface-3 pt-10">
          <h2 className="mb-4 text-lg font-light text-ink">Members</h2>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-4 border border-surface-3 bg-surface-1/95 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">
                    {member.name}
                    {member.userId === session.user.id ? (
                      <span className="text-ink-faint"> (you)</span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-ink-faint">{member.email}</div>
                </div>
                <span className="shrink-0 border border-line-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  {ROLE_LABEL[member.role]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 border-t border-surface-3 pt-10">
          <h2 className="mb-4 text-lg font-light text-ink">Invite members</h2>
          <p className="text-sm text-ink-muted">
            Invite people and manage Pending Invitations from the{" "}
            <Link
              href={`/workspaces/${workspaceId}/settings/members`}
              className="text-[#ff8a70] transition-colors duration-150 hover:text-[#ff6b4a]"
            >
              Members
            </Link>{" "}
            page.
          </p>
        </section>

        <section className="mt-10 border-t border-surface-3 pt-10">
          <h2 className="mb-4 text-lg font-light text-destructive">Danger zone</h2>
          <div className="border border-destructive/40 p-4">
            <h3 className="mb-1 text-sm font-medium text-ink">Transfer ownership</h3>
            <p className="mb-4 text-sm text-ink-muted">
              Hand this Workspace&apos;s Owner role to another member. You&apos;ll become an Admin.
            </p>
            {viewerRole === "OWNER" ? (
              <TransferOwnershipForm
                workspaceId={workspaceId}
                workspaceName={workspaceName}
                candidates={transferCandidates}
              />
            ) : (
              <p className="text-sm text-ink-faint">
                Only the current Owner can transfer ownership.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
