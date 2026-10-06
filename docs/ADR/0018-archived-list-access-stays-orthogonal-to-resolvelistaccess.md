# Archived List Access Stays Orthogonal to `resolveListAccess`

`docs/QnA/archived-list-and-deleted-workspace-access.md` (resolving [issue #85](https://github.com/codesuke/ListItUp/issues/85)) settled that an archived List's role-based access level never changes: `resolveListAccess` continues to resolve `NONE`/`READ`/`WRITE`/`LEAD` purely from who the User is, exactly as it does for an active List. Archiving instead blocks every mutation except `restoreList` (and starring/unstarring, which is exempt) via a separate check added at each mutation call site. Reads, browse, search, and export stay allowed. The existing deleted-Workspace blackout (`resolveListAccess` → `NONE` for everyone, Owner included) was confirmed correct as-is and needs no change.

## Status

accepted

## Considered Options

- Fold "archived" into `resolveListAccess` as a ceiling, mirroring the Workspace Viewer ceiling (caps every role at `READ`, or drops straight to `NONE`). Rejected: `restoreList` is itself LEAD-gated through `resolveListAccess`, so a ceiling would need a carve-out to let a Lead still restore — the exact tangle a ceiling was supposed to avoid.
- Keep `resolveListAccess` untouched by `archivedAt`; block mutations at each call site instead. Chosen — matches how `browseLists` already treats `archivedAt` as an orthogonal filter, not a role concern, and every mutation call site already has the List row (and therefore `archivedAt`) in hand before calling `resolveListAccess`, so the check is free.

## Consequences

- `archiveList`/`setListStatus`/`updateListDescription`/item creation/section, custom-field, membership, and Guest mutations all gain a `list-archived` result case, checked independently of `resolveListAccess`'s role resolution.
- `archiveList` and `restoreList` become idempotent-refuse: re-archiving an already-archived List, or restoring a non-archived one, is refused harmlessly rather than treated as an error — mirroring how deleting an already-deleted Workspace is refused (#75).
- Starring/unstarring is explicitly exempt from the archived-mutation block, since it mutates a per-User bookmark, not the List.
- The deleted-Workspace blackout is reaffirmed: there is no List-level escape hatch during the Restore Window, even for the Owner — `restoreWorkspace()` (checking `WorkspaceMember.role` directly, bypassing `resolveListAccess`) is the only way back in, mirroring this ADR's List-level answer.
- Implementation is tracked in `docs/Specs-Planned/archived-list-mutation-guard.md`.
