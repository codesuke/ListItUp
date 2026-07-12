import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { EmailSettings } from "./EmailSettings";
import { PasswordSettings } from "./PasswordSettings";
import { SessionsList, type SessionSummary } from "./SessionsList";
import { TwoFactorSettings } from "./TwoFactorSettings";

export default async function SecuritySettingsPage() {
  const session = await requireAuthenticatedSession("/settings/security");
  const rawSessions = await auth.api.listSessions({ headers: await headers() });
  const sessions: SessionSummary[] = rawSessions
    .map((entry) => ({
      token: entry.token,
      createdAt: entry.createdAt,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      isCurrent: entry.token === session.session.token,
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

  return (
    <main className="min-h-screen bg-[#080808] px-6 py-12 text-neutral-300">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Security settings"}
          </span>
        </div>

        <h1 className="text-3xl font-light text-white">Security</h1>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-light text-white">Password</h2>
          <PasswordSettings />
        </section>

        <section className="mt-10 border-t border-[#1a1a1a] pt-10">
          <h2 className="mb-4 text-lg font-light text-white">Email address</h2>
          <EmailSettings
            currentEmail={session.user.email}
            twoFactorEnabled={Boolean(session.user.twoFactorEnabled)}
          />
        </section>

        <section className="mt-10 border-t border-[#1a1a1a] pt-10">
          <h2 className="mb-4 text-lg font-light text-white">
            Active sessions
          </h2>
          <SessionsList sessions={sessions} />
        </section>

        <section className="mt-10 border-t border-[#1a1a1a] pt-10">
          <h2 className="mb-4 text-lg font-light text-white">
            Two-factor authentication
          </h2>
          <TwoFactorSettings
            twoFactorEnabled={Boolean(session.user.twoFactorEnabled)}
          />
        </section>
      </div>
    </main>
  );
}
