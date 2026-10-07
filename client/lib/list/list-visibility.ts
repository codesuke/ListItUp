// The single "is this List archived" check (#104, ADR 0018), parallel to
// isDeletedWorkspace. Archived status stays orthogonal to resolveListAccess's
// role resolution — every List-/Item-scoped mutation call site checks this
// separately, after confirming the List exists and before (or alongside) its
// own role check, so an archived List refuses even a Lead. Use whenever a
// List row (or just its archivedAt field) is already in hand.
export function isListArchived(list: { archivedAt: Date | null }): boolean {
  return list.archivedAt !== null;
}
