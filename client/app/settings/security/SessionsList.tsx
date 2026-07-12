import { revokeSessionAction } from "./actions";

export interface SessionSummary {
  token: string;
  createdAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

function describeSession(session: SessionSummary): string {
  return session.userAgent ?? "Unknown device";
}

export function SessionsList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <ul className="grid gap-3">
      {sessions.map((session) => (
        <li
          key={session.token}
          className="flex items-center justify-between gap-4 border border-[#1a1a1a] bg-[#0d0d0d]/95 p-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-neutral-300">
              {describeSession(session)}
              {session.isCurrent ? (
                <span className="ml-2 text-xs text-[#ff6b4a]">This device</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {session.ipAddress ?? "Unknown location"} &middot;{" "}
              {session.createdAt.toLocaleString()}
            </p>
          </div>

          {session.isCurrent ? null : (
            <form action={revokeSessionAction}>
              <input type="hidden" name="token" value={session.token} />
              <button
                type="submit"
                className="shrink-0 text-sm text-neutral-500 underline decoration-[#333333] underline-offset-4 transition-colors hover:text-white"
              >
                Sign out
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
