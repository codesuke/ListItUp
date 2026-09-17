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
          className="flex items-center justify-between gap-4 border border-surface-3 bg-surface-1/95 p-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">
              {describeSession(session)}
              {session.isCurrent ? (
                <span className="ml-2 text-xs text-[#ff6b4a]">This device</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {session.ipAddress ?? "Unknown location"} &middot;{" "}
              {session.createdAt.toLocaleString()}
            </p>
          </div>

          {session.isCurrent ? null : (
            <form action={revokeSessionAction}>
              <input type="hidden" name="token" value={session.token} />
              <button
                type="submit"
                className="shrink-0 text-sm text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
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
