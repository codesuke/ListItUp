// The single "is this List archived" check (#104, ADR 0018), parallel to
// isDeletedWorkspace. Archived status stays orthogonal to resolveListAccess's
// role resolution — every List-/Item-scoped mutation call site checks this
// separately from its own role check, so an archived List refuses even a
// Lead. Most call sites check this right after confirming the List exists,
// before resolving the actor's role; archiveList/restoreList themselves
// check it after their own forbidden check instead, so an unauthorized
// caller still gets "forbidden" rather than a free read of whether the List
// happens to already be archived. Use whenever a List row (or just its
// archivedAt field) is already in hand.
export function isListArchived(list: { archivedAt: Date | null }): boolean {
  return list.archivedAt !== null;
}
