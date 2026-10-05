# A List Is Its Own Identity: Admins Have No Implicit List Access

`docs/QnA/list-lead-rules.md` (resolving [issue #83](https://github.com/codesuke/ListItUp/issues/83)) settled the List Lead invariants and, with them, who can reach a private List. The user's framing: a List is an identity in itself, so its Lead has every access inside it, the Workspace Owner does too, and a Workspace Admin cannot touch anything in a List until given access to it. This supersedes the Admin part of ADR 0009's "Workspace `Owner` and `Admin` implicitly see every List"; the Owner part stands.

## Status

accepted (supersedes ADR 0009 for Admin only)

## Considered Options

- Keep ADR 0009: Owner and Admin both implicitly access every List. Gives Admins a way to rescue a Lead-less List, but private Lists are not private from Admins, which contradicts the intent that a List belongs to its own people.
- Owner keeps implicit Lead-equivalent access; Admin has none until explicitly added. Chosen.

## Consequences

- A List with no resolved access for a User is invisible to them: not listed, not searchable, not reachable by URL, or counted in aggregates. Admins fall under this like any non-member. An Admin who creates a List becomes its first Lead.
- A List always has at least one explicit Lead, counted over explicit Lead rows only. The Owner's implicit access does not count. The rule binds every actor, including the Owner.
- An Admin cannot rescue a List; only the Owner (implicit access) or a Lead (adding the Admin) can.
- Ownership transfer removes the former Owner's access to private Lists they never joined.
- Surfaces that follow ADR 0009's Owner/Admin visibility rule (for example the global search filter in ADR 0015) must be updated to match.
- Implementation is tracked in `docs/Specs-Planned/list-lead-rules.md`.
