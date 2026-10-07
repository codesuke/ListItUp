# List Lead Rules

## Problem Statement

A List is meant to be an identity in itself, run by its Lead(s). Today that isn't enforced. Adding a List member is an upsert, so it silently overwrites and demotes an existing Lead, including the last one. A Lead can remove themselves or the last Lead, leaving a List with nobody accountable for it. A Workspace Viewer can hold a `LEAD` or `MEMBER` List role that does nothing, because the Viewer ceiling caps it. Workspace Admins can see and edit every private List through implicit access, which contradicts the intent that a private List belongs to its own people. Removing a User from a Workspace, or letting them leave, can orphan the Lists they alone led. The rules live only in one Server Action allow-list, so other callers bypass them (audit #81, row 15).

## Solution

Make the Lead rules invariants of the domain, enforced server-side wherever a List role or Workspace membership changes:

- A List always has at least one explicit Lead.
- Multiple Leads are allowed.
- Nobody can lose their access to a Workspace while they are the sole Lead of any List. A clear pop-up explains why.
- A Workspace Viewer can only be a List Viewer.
- Workspace Admins no longer have implicit access to Lists. A List is invisible to an Admin until a Lead or the Owner adds them. An Admin who creates a List becomes its first Lead.
- The Workspace Owner keeps implicit Lead-equivalent access to every List. The Owner doesn't count toward the "at least one Lead" rule.

This supersedes the Admin part of ADR 0009's "Owner/Admin implicitly see every List" (resolved in #83).

## User Stories

1. As a List's creator, I want to become its first Lead automatically, so that someone is always accountable for the List.
2. As a Workspace Owner who creates a List, I want an explicit Lead row for myself, so that the List satisfies the same rule as every other List.
3. As a Workspace Admin who creates a List, I want to become its first Lead, so that I can work in the List I just made without needing anyone to add me.
4. As a List Lead, I want to promote another List Member to Lead, so that leadership can be shared.
5. As a List Lead, I want to step down from Lead when another Lead exists, so that I can hand over a List without a special transfer action.
6. As a List Lead, I want to be blocked from stepping down when I'm the only Lead, so that the List is never left without a Lead.
7. As a List Lead, I want a clear message when "Step down" or "Remove" is blocked because the person is the last Lead, so that I know to promote someone first.
8. As a List Lead, I want adding a person who is already a Lead to never silently demote them, so that a routine action can't strip leadership.
9. As a List Lead, I want to demote another Lead to Member or Viewer only while at least one other Lead remains, so that a demotion can't leave the List without a Lead.
10. As a List Lead, I want to remove another Lead only while at least one other Lead remains, for the same reason.
11. As a Workspace Owner, I want the last-Lead rule to apply to me too when I act on a List, so that the invariant has no exceptions.
12. As a Workspace Owner, I want to act in any List without being a member, with the same powers as a Lead, so that I keep ultimate control of my Workspace.
13. As a Workspace Owner, I want to add a Lead to any List, so that I can recover a List whose Leads are unavailable.
14. As a Workspace Owner transferring ownership, I want to understand that I'll lose access to private Lists I never joined, so that the transfer is an informed decision.
15. As a former Owner who is now an Admin, I want to keep Lead on the Lists I created, so that I still run my own Lists.
16. As a Workspace Admin, I want private Lists I'm not in to be invisible to me, so that private Lists really belong to their people.
17. As a Workspace Admin, I want no ability to edit, archive, restore, delete or change the Status of a List I'm not in, so that Admins have no hidden power over Lists.
18. As a Workspace Admin, I want Lists I'm not in excluded from search, aggregates and Workspace Analytics, so that nothing leaks their existence.
19. As a Workspace Admin, I want to keep managing the Workspace's members, invitations, settings and Labels, and keep creating Lists, so that my Workspace-level job is unchanged.
20. As a Workspace Admin who has been explicitly added to a List, I want my List-level role to apply normally, so that I can work in it like any other member.
21. As a Workspace Admin, I want to be told which Lists block my own removal, demotion or departure, by count only, so that I can act without learning about Lists I can't see.
22. As an Admin removing a Workspace Member, I want a pop-up explaining that the User is the sole Lead of N Lists and must hand them over first, so that I understand why the removal was blocked.
23. As a Workspace Member who is the sole Lead of a List, I want to be blocked from leaving the Workspace, with a pop-up explaining why, so that I don't strand the List.
24. As a User who is the sole Lead of a List, I want my account deletion blocked with a clear reason, so that deleting my account can't orphan the List.
25. As an Admin demoting a Member who is a Lead, I want the demotion to Workspace Viewer blocked while they are the sole Lead of any List, so that the Viewer rule and the Lead rule both hold.
26. As an Admin demoting a Lead to Workspace Viewer, where they are not a sole Lead, I want their List `LEAD` and `MEMBER` roles converted to List `VIEWER` automatically, so that stored roles match the ceiling.
27. As a List Lead, I want an attempt to add a Workspace Viewer as Lead or Member rejected with a clear message, so that every Lead row means a working Lead.
28. As a List Lead, I want to add a Workspace Viewer as a List Viewer, so that they can still read the List.
29. As a List Lead, I want to add a Workspace Member or Admin as Lead, Member or Viewer, so that roles are flexible for anyone who can hold them.
30. As a User in a Personal Space, I want to be the sole and permanent Lead of my Lists without extra steps, so that personal use stays frictionless.
31. As a Platform maintainer, I want the Lead invariants enforced in the domain functions and not only in a Server Action, so that no caller can bypass them.
32. As a Platform maintainer, I want two simultaneous demotions or removals of the last two Leads to serialize, with the second failing, so that races can't leave zero Leads.
33. As a Platform maintainer, I want existing Lead-less Lists repaired by a migration, so that the invariant holds from day one.
34. As a Platform maintainer, I want existing Workspace Viewers with `LEAD` or `MEMBER` List rows downgraded to `VIEWER`, so that existing data matches the new rules.
35. As a developer, I want a single access-resolution function that implements these rules, so that every feature's authorization is consistent.

## Implementation Decisions

- **Access resolution.** Workspace Admin no longer resolves to any implicit List access. Workspace Owner resolves to Lead-equivalent access, and the separate `ADMIN` access level is removed. The resolution order becomes: Owner implicit access, Workspace Viewer ceiling, explicit List role, Guest access, none. Admin falls through to their explicit List role, if any.
- **Invisibility.** A List with no resolved access for the User is invisible: not listed, not searchable, not reachable by URL, and not counted in aggregates (Workspace Analytics, Peer Comparison, global search, List browsing). Admins fall under this rule like any other non-member.
- **Never-zero Leads.** "At least one Lead" is counted over explicit Lead rows only. The Owner's implicit access does not count. Applies to remove, demote, step-down and leave, for every actor including the Owner.
- **Creator is first Lead.** List creation always writes an explicit Lead row for the creator. This includes the Owner and Admins, and Personal Space Lists.
- **No upsert-demote.** Adding a member who already has a List role must not change a Lead's role. Role changes become a separate, guarded operation. Callers, including the existing Roles panel action, get a typed result that distinguishes `last-lead` from other failures.
- **Promote to Lead.** The Roles panel gains "Make Lead" and "Step down". There is no dedicated "transfer Lead" action. A transfer is promote-then-step-down, with each step guarded.
- **Viewer rule.** Assigning `LEAD` or `MEMBER` to a Workspace Viewer is rejected at write time with a typed result. Only List `VIEWER` is accepted.
- **Workspace access loss.** Removal from a Workspace, voluntary leaving, demotion to Workspace Viewer and account deletion are blocked while the User is the sole Lead of any List. The result carries the count of blocking Lists, never their names or identities. The UI shows a pop-up giving the reason and the count. Account deletion must not rely on the cascade that deletes the member's List rows.
- **Demotion to Viewer, non-sole Lead.** When allowed, the User's List `LEAD` and `MEMBER` rows convert to `VIEWER` in the same operation.
- **Atomicity.** The last-Lead check and the write run in one transaction that locks the List row, so concurrent changes to the same List serialize and the loser receives `last-lead`.
- **Glossary and ADR.** `CONTEXT.md` is updated in the #83 grilling for Admin, Workspace Owner, List Lead and Viewer. A new ADR supersedes the Admin part of ADR 0009. The Owner/Admin wording in the permissions spec's user stories is amended to match.
- **Data migration** (via `prisma migrate dev`, never hand-edited):
  - Every List with zero Leads gets the Workspace Owner added as Lead.
  - Workspace Viewers' `LEAD` and `MEMBER` List rows are downgraded to `VIEWER`.
  - Confirmed by the user as option (a) of Q8 in the #83 grilling.
- **Behavior change for existing Admins.** Admins lose their current access to Lists they aren't in. No data change is needed, only the resolution change. Existing Lists an Admin created keep their explicit Lead row.

## Testing Decisions

- **Principle.** Tests exercise external behavior through existing public functions against the real database, and assert on typed results and resulting access. They don't test internal helpers or call order.
- **Seams (one extension per area, no new seams):**
  - List membership integration tests: add, promote, demote, remove and step-down, including the last-Lead block for Lead, Admin and Owner actors, no upsert-demote, Viewer rejection, and concurrent demotion of two Leads.
  - Workspace membership integration tests (removal, leaving, role change) and account deletion: the sole-Lead block with the blocking count, and automatic `VIEWER` conversion on a non-blocking demotion.
  - List creation tests: the creator, whether Owner, Admin or Member in a Personal Space, is always an explicit Lead.
  - List-access resolution tests: Admin has no access without a row, Owner has Lead-equivalent access, the Viewer ceiling, and Admin invisibility in browse, search and aggregates.
  - Migration verification: run against a fixture with Lead-less Lists and Viewer Lead rows.
- **Prior art.** The existing list-membership integration tests, the list-access resolution tests, the workspace ownership tests and the list-lifecycle integration tests.

## Out of Scope

- Any change to Guest access rules.
- A dedicated "transfer Lead" action.
- An Admin-visible directory of Lists the Admin is not in, or any self-add path for Admins.
- Auto-promoting the Owner when a sole Lead leaves. The block applies instead.
- Channel permissions, which remain governed by ADR 0013.

## Further Notes

- Source: wayfinder grilling ticket #83, with audit input from #81 (row 15).
- Hard consequence of invisible Lists: an Admin can't rescue a List. Only the Owner can, through implicit access, or a Lead can by adding the Admin.
- Ownership transfer removes the former Owner's access to private Lists they never joined.
