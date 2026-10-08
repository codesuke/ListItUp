# Remove List-Scoped Guests

ADR 0009 introduced `Guest` as a third, deliberately separate way into a List: read-only access to one specific List for an external person with no Workspace membership. In practice it never earned its place. A real Guest could not open the List at all, because every List route sits under the Workspace shell, which requires Workspace membership. Making Guests work would have needed a separate shell, its own data-exposure rules, eligibility checks, self-leave, and a pending-invitation flow, all for a case the Workspace Viewer role plus a List Viewer role already covers. So Guest is removed rather than finished: the only way into a List is an explicit List role (`Lead`/`Member`/`Viewer`) held by an existing Workspace member, or being the Workspace Owner.

## Status

accepted (supersedes the Guest half of ADR 0009, and the Guest half of ADR 0013)

## Consequences

- The `guest` table is dropped, along with every Guest grant in it. People who need read-only access to one List join the Workspace as a Viewer and are added to that List as a List Viewer.
- Effective List access resolves Workspace Owner implicit access → Workspace Viewer ceiling → explicit List role (backed by a current Workspace membership, per ADR 0019) → no access. ADR 0019's carve-out for the Guest path no longer applies.
- Removing someone from a Workspace no longer has Guest grants to clean up.
- Anyone who can read a List can export it, since there is no longer a reader without a Workspace identity to exclude.
- The Roles board has three columns (Lead, Member, Viewer). Every card on it is a List member, so a drag is the same guarded role change as "Make Lead", including the Workspace Viewer ceiling.
- Adding someone to a List by email requires that they already be a Workspace member; an outsider has to be invited into the Workspace first.
- Bringing back external access later is a new decision, and should start from how an external person reaches the List page without the Workspace shell.
