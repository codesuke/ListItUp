import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { resolveProtectedRouteRedirect } from "@/lib/session/protected-route";

export async function requireAuthenticatedSession(currentPath: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  const redirectTo = resolveProtectedRouteRedirect(session, currentPath);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return session!;
}
