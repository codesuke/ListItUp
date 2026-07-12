"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { acceptInvitation } from "@/lib/workspace/workspace-invitations";

export async function acceptInvitationAction(
  formData: FormData
): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) {
    return;
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    const callbackURL = `/accept-invitation?token=${encodeURIComponent(token)}`;
    redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
  }

  const result = await acceptInvitation(
    prisma,
    token,
    session.user.id,
    session.user.email
  );

  if (result.status === "accepted") {
    redirect(`/workspaces/${result.workspaceId}`);
  }

  redirect(
    `/accept-invitation?token=${encodeURIComponent(token)}&error=${result.status}`
  );
}
