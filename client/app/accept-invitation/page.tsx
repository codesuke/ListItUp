import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { resolveInvitation } from "@/lib/workspace/workspace-invitations";
import { acceptInvitationAction } from "./actions";

const cardClass = "w-full max-w-md border border-[#1a1a1a] bg-[#0b0b0b]/80 p-8";
const kickerClass = "mb-6 flex items-center gap-4";
const primaryButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] w-full items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-[#080808]";
const secondaryLinkClass =
  "inline-flex h-[58px] w-full items-center justify-center border border-[#1a1a1a] bg-[#0d0d0d]/95 text-sm text-neutral-300 transition-colors hover:border-[#333333] hover:text-white";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-neutral-300">
      <div className={cardClass}>
        <div className={kickerClass}>
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Workspace invitation"}
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <h1 className="text-2xl font-light text-white">Invalid invitation</h1>
        <p className="mt-3 text-sm text-neutral-400">
          This invitation link is missing or malformed.
        </p>
      </Shell>
    );
  }

  const invitation = await resolveInvitation(prisma, token);

  if (!invitation) {
    return (
      <Shell>
        <h1 className="text-2xl font-light text-white">
          This invitation is no longer valid
        </h1>
        <p className="mt-3 text-sm text-neutral-400">
          It may have expired or already been used. Ask a Workspace Admin to
          send a new one.
        </p>
      </Shell>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const callbackURL = `/accept-invitation?token=${encodeURIComponent(token)}`;

  if (!session) {
    return (
      <Shell>
        <h1 className="text-2xl font-light text-white">
          Join {invitation.workspaceName}
        </h1>
        <p className="mt-3 text-sm text-neutral-400">
          Sign in or create an account with {invitation.email} to accept.
        </p>

        <div className="mt-8 grid gap-3">
          <Link
            href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
            className={primaryButtonClass}
          >
            Sign in to accept
          </Link>
          <Link
            href={`/sign-up?email=${encodeURIComponent(invitation.email)}&callbackURL=${encodeURIComponent(callbackURL)}`}
            className={secondaryLinkClass}
          >
            Sign up to accept
          </Link>
        </div>
      </Shell>
    );
  }

  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="text-2xl font-light text-white">
          Wrong account signed in
        </h1>
        <p className="mt-3 text-sm text-neutral-400">
          This invitation was sent to {invitation.email}, but you&apos;re signed
          in as {session.user.email}. Sign out and sign back in with the invited
          email to accept.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-light text-white">
        Join {invitation.workspaceName}
      </h1>
      <p className="mt-3 text-sm text-neutral-400">
        Accept this invitation to start collaborating in{" "}
        {invitation.workspaceName}.
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-[#ff8a70]">
          That didn&apos;t work. Try again.
        </p>
      ) : null}

      <form action={acceptInvitationAction} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={primaryButtonClass}>
          Accept invitation
        </button>
      </form>
    </Shell>
  );
}
