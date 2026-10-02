import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { loadWorkspaceMembersPageData } from "./page-data";

const ROLE_LABEL = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
} as const;

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

  const { workspaceName, members } = data;

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
      </div>
    </main>
  );
}
