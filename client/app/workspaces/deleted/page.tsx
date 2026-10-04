import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { loadDeletedWorkspacesPageData } from "./page-data";
import { RestoreWorkspaceButton } from "./RestoreWorkspaceButton";

const DELETED_WORKSPACES_PATH = "/workspaces/deleted";

function formatDeletedDate(deletedAt: Date): string {
  return deletedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function DeletedWorkspacesPage() {
  const session = await requireAuthenticatedSession(DELETED_WORKSPACES_PATH);
  const deletedWorkspaces = await loadDeletedWorkspacesPageData(prisma, session.user.id);

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink animate-in fade-in duration-200">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Deleted Workspaces"}
          </span>
        </div>

        <h1 className="text-3xl font-light text-ink">Deleted Workspaces</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Workspaces you own that were deleted can be restored within 3 months of deletion.
          After that, they&apos;re purged for good.
        </p>

        <div className="mt-10">
          {deletedWorkspaces.length === 0 ? (
            <p className="text-sm text-ink-faint">You have no deleted Workspaces.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {deletedWorkspaces.map((workspace) => (
                <li
                  key={workspace.id}
                  className="flex items-center justify-between gap-4 border border-surface-3 bg-surface-1/95 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{workspace.name}</div>
                    <div className="truncate text-xs text-ink-faint">
                      Deleted {formatDeletedDate(workspace.deletedAt)} &middot;{" "}
                      {workspace.daysRemaining}{" "}
                      {workspace.daysRemaining === 1 ? "day" : "days"} left to restore
                    </div>
                  </div>
                  <RestoreWorkspaceButton workspaceId={workspace.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-ink-muted transition-colors hover:text-ink"
        >
          Back
        </Link>
      </div>
    </main>
  );
}
