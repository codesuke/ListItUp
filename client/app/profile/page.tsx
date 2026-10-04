import { LogOut, User as UserIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/workspace/AppShell";
import { GlobalHeaderActions } from "@/components/workspace/GlobalHeaderActions";
import { countUnreadNotifications } from "@/lib/notification/notification-inbox";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { resolveDefaultWorkspaceId } from "@/lib/workspace/default-workspace";

import { signOutAction } from "./actions";
import { EditProfileForm } from "./EditProfileForm";
import { loadProfilePageData } from "./page-data";

type Query = { workspace?: string };
type Props = { searchParams: Promise<Query> };

export default async function ProfilePage({ searchParams }: Props) {
  const session = await requireAuthenticatedSession("/profile");
  const query = await searchParams;

  const [data, requestedMembership, unreadNotificationCount] = await Promise.all([
    loadProfilePageData(prisma, session.user.id),
    query.workspace
      ? prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: query.workspace, userId: session.user.id } },
          include: { workspace: true },
        })
      : null,
    countUnreadNotifications(prisma, session.user.id),
  ]);

  if (!data) {
    notFound();
  }

  // Same requested-membership-or-fallback pattern as /updates and
  // /settings/notifications — Profile is cross-Workspace too, so there's
  // no URL segment to source currentWorkspaceId from.
  const workspaceId = requestedMembership?.workspaceId ?? (await resolveDefaultWorkspaceId(prisma, session.user.id));
  if (!workspaceId) {
    notFound();
  }

  const workspace =
    requestedMembership?.workspace ??
    (await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, kind: true },
    }));

  if (!workspace) {
    notFound();
  }

  return (
    <AppShell
      currentWorkspaceId={workspaceId}
      currentWorkspaceName={workspace.kind === "PERSONAL" ? "Personal Space" : workspace.name}
      userId={session.user.id}
    >
      <div className="flex min-h-screen flex-col animate-in fade-in duration-200">
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-1 px-7">
          <h1 className="text-[13px] font-semibold text-ink">Profile</h1>
          <GlobalHeaderActions
            currentUserName={session.user.name}
            unreadNotificationCount={unreadNotificationCount}
            workspaceId={workspaceId}
          />
        </header>

        <main className="flex-1 bg-canvas px-10 pb-16 pt-8">
          <div className="mx-auto max-w-xl">
            <div className="mb-10 flex items-center gap-4 rounded-xl border border-line bg-surface-2 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {data.image ? (
                // A User-supplied avatar URL is an arbitrary external host, not
                // a locally controlled remote pattern next/image can optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.image}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded-full border border-line-strong object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-3">
                  <UserIcon className="h-7 w-7 text-ink-faint" strokeWidth={1.7} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold text-ink">{data.name}</p>
                <p className="truncate text-[12.5px] text-ink-muted">{session.user.email}</p>
                {data.aboutMe ? (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-ink-muted">{data.aboutMe}</p>
                ) : null}
              </div>
            </div>

            <section>
              <h2 className="mb-1.5 text-[22px] font-semibold tracking-tight text-ink">Edit your profile</h2>
              <p className="mb-6 text-[13px] text-ink-muted">
                Update your display name, avatar, and about me.
              </p>
              <EditProfileForm name={data.name} image={data.image} aboutMe={data.aboutMe} />
            </section>

            <section className="mt-10 border-t border-line pt-8">
              <h2 className="mb-1.5 text-[15px] font-semibold text-ink">Account</h2>
              <p className="mb-4 text-[12.5px] text-ink-muted">Sign out of ListItUp on this device.</p>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-4 text-[13px] font-medium text-ink transition-colors duration-150 hover:border-[#f2545b] hover:text-[#f2545b]"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
