import Link from "next/link";

import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

import { CreateWorkspaceForm } from "./CreateWorkspaceForm";

export default async function NewWorkspacePage() {
  await requireAuthenticatedSession("/workspaces/new");

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink animate-in fade-in duration-200">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// New Workspace"}
          </span>
        </div>

        <h1 className="text-3xl font-light text-ink">Create a Workspace</h1>
        <p className="mt-3 text-sm text-ink-muted">
          A shared space for a team&apos;s Lists. You&apos;ll be its Owner, and can invite people once it exists.
        </p>

        <div className="mt-10">
          <CreateWorkspaceForm />
        </div>

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-ink-muted transition-colors hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
