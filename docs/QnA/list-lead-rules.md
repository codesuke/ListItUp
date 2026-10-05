# Grill Session: List Lead Rules

## Context

Design ticket [#83](https://github.com/codesuke/ListItUp/issues/83), with audit input from [#81](https://github.com/codesuke/ListItUp/issues/81) (row 15): `addListMember` upsert overwrites or demotes an existing Lead, `removeListMember` can remove the last Lead or oneself, and the no-Lead allow-list lives only in one Server Action.

This file records the settled outcomes. The full spec is `docs/Specs-Planned/list-lead-rules.md`, the decision is ADR 0017, and the glossary changes are in `CONTEXT.md`. The question-by-question transcript, including the Q8 follow-up, was not saved; outcomes below are taken from the issue and the spec.

User input (verbatim): "list is an identity in itself so lead has every access inside that as well as workspace owner, workspace admin can not edit anything inside list until they have access for it".

## Settled Outcomes

- **Creator**: the creator of a List always becomes its first Lead via an explicit row, including the Owner, Admins, and Personal Space Lists.
- **Multiple Leads**: allowed.
- **Never zero Leads**: the last Lead cannot be removed, demoted, or leave. Counted over explicit Lead rows only; the Owner's implicit access does not count. Applies to every actor, including the Owner.
- **Transfer**: no dedicated action. Promote another member to Lead, then step down; each step is guarded.
- **Add never demotes**: adding someone who already has a List role must not change a Lead's role.
- **Sole Lead and Workspace access**: removal, leaving, demotion to Workspace Viewer, and account deletion are blocked while the User is sole Lead of any List. The UI shows a pop-up with the reason and the count of blocking Lists, never their names.
- **Viewer**: a Workspace Viewer can only be a List Viewer. Assigning Lead or Member is rejected. A non-blocking demotion to Workspace Viewer converts their List Lead and Member rows to Viewer.
- **Owner**: implicit Lead-equivalent access to every List, without being a member.
- **Admin**: no implicit List access; Lists are invisible to them until explicitly added. This reverses ADR 0009 for Admin (ADR 0017).
- **Existing data (Q8, option a)**: Lists with zero Leads get the Workspace Owner added as Lead; Workspace Viewers' Lead and Member List rows are downgraded to Viewer.
- **Out of scope**: Guest access, a transfer-Lead action, an Admin-visible directory of Lists, auto-promoting the Owner, Channel permissions.
