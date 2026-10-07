// A signed-in User with no WorkspaceMember row for a given workspaceId is
// sent to a Workspace they still belong to rather than left at a dead
// end — most often someone just removed from the Workspace (#91)
// following a stale link or the removal notice email's own link, but the
// same redirect is the right call for any other cause of missing
// membership too (a mistyped id, a revoked invite): there's nothing on
// that id to show them either way, so bouncing them onward beats a 404
// wall. Mirrors resolveRootRedirect's identical fallback
// (lib/session/root-landing.ts).
export function resolveWorkspaceLayoutRedirectTarget(defaultWorkspaceId: string | null): string {
  return defaultWorkspaceId ? `/workspaces/${defaultWorkspaceId}` : "/";
}
