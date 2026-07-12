import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await requireAuthenticatedSession(
    `/workspaces/${workspaceId}`
  );

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
    include: { workspace: true },
  });
  const isOwner = await prisma.workspace.findUnique({
    where: { id: workspaceId, ownerId: session.user.id },
  });
  const workspace = membership?.workspace ?? isOwner;

  if (!workspace) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#080808] px-6 py-12 text-neutral-300">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Workspace"}
          </span>
        </div>
        <h1 className="text-3xl font-light text-white">{workspace.name}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
          You&apos;re a member of this Workspace. Lists and Items land in a
          future release.
        </p>
      </div>
    </main>
  );
}
