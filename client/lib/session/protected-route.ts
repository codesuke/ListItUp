export interface ProtectedRouteSession {
  user: {
    email: string;
    emailVerified: boolean;
  };
}

export function resolveProtectedRouteRedirect(
  session: ProtectedRouteSession | null,
  currentPath: string
): string | null {
  if (!session) {
    return `/sign-in?callbackURL=${encodeURIComponent(currentPath)}`;
  }

  if (!session.user.emailVerified) {
    return `/verify-email?email=${encodeURIComponent(
      session.user.email
    )}&returnTo=${encodeURIComponent(currentPath)}`;
  }

  return null;
}
