import { notFound } from "next/navigation";
import { User as UserIcon } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedSession } from "@/lib/session/require-authenticated-session";
import { EditProfileForm } from "./EditProfileForm";
import { loadProfilePageData } from "./page-data";

export default async function ProfilePage() {
  const session = await requireAuthenticatedSession("/profile");
  const data = await loadProfilePageData(prisma, session.user.id);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-14 bg-[#ff6b4a]" />
          <span className="font-mono text-xs uppercase tracking-[0.24em] text-[#ff6b4a]">
            {"// Profile"}
          </span>
        </div>

        <h1 className="text-3xl font-light text-ink">{data.name}</h1>

        <div className="mt-8 flex items-center gap-4">
          {data.image ? (
            // A User-supplied avatar URL is an arbitrary external host, not
            // a locally controlled remote pattern next/image can optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.image}
              alt=""
              className="h-16 w-16 rounded-full border border-surface-3 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-surface-3 bg-surface-1">
              <UserIcon
                className="h-7 w-7 text-ink-faint"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </div>
          )}
          {data.aboutMe ? (
            <p className="max-w-sm text-sm leading-6 text-ink-muted">
              {data.aboutMe}
            </p>
          ) : null}
        </div>

        <section className="mt-10 border-t border-surface-3 pt-10">
          <h2 className="mb-4 text-lg font-light text-ink">
            Edit your profile
          </h2>
          <EditProfileForm
            name={data.name}
            image={data.image}
            aboutMe={data.aboutMe}
          />
        </section>
      </div>
    </main>
  );
}
