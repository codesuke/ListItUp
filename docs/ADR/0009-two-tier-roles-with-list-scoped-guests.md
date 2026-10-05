# Two-Tier Roles With List-Scoped Guests

Under the old model, Workspace roles (`Admin`/`Member`/`Viewer`) were the only permission layer, and Lists were shared to the whole Workspace by default. At "medium fish" scale, a Workspace can hold many Lists with different leads and members, and not everyone in the Workspace should see every List — so ListItUp adds a second, independent permission tier. Workspace-level roles (`Owner`, `Admin`, `Member`, `Viewer`) now govern Workspace-wide concerns (membership, Workspace settings, who can create Lists); a separate List-level ladder (`Lead`, `Member`, `Viewer`) governs access to one specific List's content, and Lists are private by default. `Workspace Owner` and `Admin` implicitly see every List regardless of List-level membership; Workspace `Member` and `Viewer` see only Lists they're explicitly added to. `Viewer` (at either tier) is a hard permission ceiling — never upgraded to write access by a List-level role. A third, deliberately separate concept, `Guest`, covers external people: a Guest is granted read-only access to one specific List without ever becoming a Workspace member at all, and has no visibility beyond that List. This reverses the old settled decision that Lists default to Workspace-wide visibility (`docs/QnA/listitup-product-model.md`, now superseded).

## Status

accepted (the Admin-implicit-access part is superseded by `0017-list-is-its-own-identity-admin-has-no-implicit-list-access.md`; the Owner part stands)

## Consequences

- The data model needs three separate membership concepts: `WorkspaceMembership` (role: Owner/Admin/Member/Viewer), `ListMembership` (role: Lead/Member/Viewer, only for existing Workspace members), and `GuestAccess` (List-scoped, read-only, keyed by user/email + List, no Workspace membership).
- Every permission check must resolve effective access by walking Workspace Owner/Admin implicit-access → Workspace Viewer ceiling → explicit List role → Guest access → no access, and must be enforced server-side (never inferred from hidden UI). _Admin implicit access is removed by `0017-list-is-its-own-identity-admin-has-no-implicit-list-access.md`; the resolution order is now Owner implicit access → Workspace Viewer ceiling → explicit List role → Guest access → no access._
- Private Lists must be genuinely invisible to Users without access — not listed, not searchable, not discoverable via a guessed URL.
- Only `Admin` and `Workspace Owner` can create new Lists; a plain `Member` cannot self-serve a new List. This can be revisited later if that proves too restrictive.
- Inviting into the Workspace (choice of `Member`/`Viewer`) and granting Guest access to a List are two distinct flows with different authorized inviters and different resulting identities.
