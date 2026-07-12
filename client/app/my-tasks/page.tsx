import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";

export default async function MyTasksPage() {
  const session = await requireAuthenticatedSession("/my-tasks");

  return (
    <main className="min-h-screen bg-[#080808] px-6 py-12 text-neutral-300">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// My Tasks"}
          </span>
        </div>
        <h1 className="text-3xl font-light text-white">
          Welcome, {session.user.name}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
          Your personal Workspace and Inbox List are ready. Item capture and
          task planning land in a future release.
        </p>
      </div>
    </main>
  );
}
