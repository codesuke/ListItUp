## Problem Statement

A Workspace Owner or Admin has no way to bring people into a Workspace. The accept side of invitations exists (the invitation link, sign-up with a locked email, acceptance into a Workspace-level role), but nothing creates a Pending Invitation, sends the email, or lets anyone resend or revoke one. There is also no members screen in a Workspace, so nobody can see who belongs to it.

## Solution

Owners and Admins get a members page in the Workspace's settings. It lists everyone in the Workspace, lists Pending Invitations, and has a form to invite one person by email as a Member or a Viewer. A Pending Invitation expires after 7 days and can be resent (new link, fresh 7 days) or revoked. Every Workspace member, including Members and Viewers, can see the members list, but only Owners and Admins see the invite form and the Pending Invitation controls. Accepting an invitation grants the chosen Workspace-level role and nothing else; adding the person to Lists is a separate step.

## User Stories

1. As a Workspace Owner, I want to invite a person to my Workspace by email, so that I can start collaborating with them.
2. As a Workspace Admin, I want to invite a person to my Workspace by email, so that I can grow the team without asking the Owner.
3. As an inviter, I want to choose Member or Viewer for each invitation, so that the person starts with the right level of access.
4. As an inviter, I want the role to default to Member, so that the common case needs no extra clicks.
5. As an inviter, I want Admin and Owner to be absent from the role choice, so that I cannot accidentally hand out management authority through an invitation.
6. As a Workspace Member, I want the invite form to be hidden from me, so that I am not offered an action I cannot perform.
7. As a Workspace Viewer, I want the invite form to be hidden from me, so that I am not offered an action I cannot perform.
8. As a User in a Personal Space, I want no way to invite anyone there, so that my private space stays single-member.
9. As an inviter, I want the invitee's email normalized and matched case-insensitively, so that capitalization differences do not break acceptance.
10. As an inviter, I want an invitation to someone who is already a Member to be rejected with a clear message, so that I do not create a useless invitation.
11. As an inviter, I want inviting an email that already has a Pending Invitation to act as a resend, so that I never create duplicate invitations for the same person.
12. As an inviter, I want the invitation email to name me and the Workspace and state when it expires, so that the invitee recognizes it as legitimate.
13. As an inviter, I want to see an error and no leftover Pending Invitation if the email fails to send, so that the list never shows invitations nobody received.
14. As an invitee without an account, I want the invitation link to take me through sign-up with my invited email already fixed, so that I join with the address that was invited.
15. As an invitee with an account under the invited email, I want to sign in and accept, so that joining takes one step.
16. As an invitee signed in under a different email, I want a clear mismatch message, so that I understand I must be invited at the address I actually use.
17. As an invitee, I want to receive exactly the role the inviter chose, so that my access matches what was agreed.
18. As an invitee, I want accepting to give me no List access, so that I only see Lists I am later added to.
19. As an Owner or Admin, I want to see all Pending Invitations with email, role, who invited them and when they expire, so that I know who is still outstanding.
20. As an Owner or Admin, I want expired invitations to stay visible marked Expired, so that I can tell someone's link lapsed and resend it.
21. As an Owner or Admin, I want to resend an invitation, so that someone who lost the email or let it expire can still join.
22. As an Owner or Admin, I want resending to invalidate the previous link and restart the 7-day window, so that an old forwarded link stops working.
23. As an Owner or Admin, I want to revoke a Pending Invitation, so that a mistaken or unwanted invitation can no longer be accepted.
24. As an invitee holding a revoked link, I want to be told the invitation is no longer valid, so that I know to ask for a new one.
25. As an Owner or Admin, I want accepted invitations to disappear from the pending list, so that the list only shows outstanding work.
26. As an Owner or Admin, I want invitation sending to be rate limited per inviter and per Workspace, so that the form cannot be used to spam arbitrary addresses.
27. As any Workspace member, I want to see the members list with each person's Display Name and role, so that I know who I am working with.
28. As a Workspace Viewer, I want to see the members list read-only, so that I understand the team even without edit rights.
29. As a User who is not a member of a Workspace, I want the members page to be inaccessible, so that membership stays private.
30. As a Platform Operator or security reviewer, I want authorization enforced in the invitation functions themselves, not only in the page, so that a direct server action call cannot bypass it.
31. As a developer, I want the invitation module to be testable with the mailer and rate limiter injected, so that behavior can be proven without SMTP or Redis.

## Implementation Decisions

- **Invitation module.** The existing Workspace invitation module is extended with create, resend, revoke and list-pending operations alongside the existing resolve and accept ones. Each new operation takes the acting User and enforces authorization itself; the server actions that call them stay thin.
- **Authorization.** Only the Workspace Owner and Admins may create, resend or revoke invitations. Invitations into a Personal Space-kind container are rejected. Authorization is evaluated inside the module, consistent with the project rule that a Server Action is not itself a security boundary.
- **Roles.** Invite-time roles remain Member or Viewer only, as already fixed by ADR 0009; the form defaults to Member. Acceptance grants only the Workspace-level role and never adds List access.
- **Email handling.** Invitee email is normalized with the existing email normalization on write. Acceptance continues to require a case-insensitive match with the signed-in account's email, with no "accept as a different email" path.
- **Duplicate handling.** Inviting someone who is already a Workspace member is rejected. Inviting an email that already has an unaccepted invitation is treated as a resend of that invitation rather than creating a second row.
- **Expiry.** Invitations live 7 days, defined once as a named constant that also feeds the email's expiry text. Expired invitations remain in the pending list labeled Expired with a Resend action.
- **Resend.** Resending issues a new unguessable token and resets the expiry, which invalidates the old link, then sends the email again.
- **Revoke.** Revoking hard-deletes the invitation; the old token then resolves as invalid. Accepted invitations remain as historical rows and are excluded from the pending list.
- **Schema change.** `WorkspaceInvitation` gains a nullable `invitedById` referencing the inviting User, set to null if that User is deleted. It is used to name the inviter in the email and in the pending list. The migration is created with `prisma migrate dev` from `client/`, never hand-edited.
- **Email delivery.** The existing invitation email template is used, with the inviter's Display Name, Workspace name, link and expiry in days. If delivery fails, the operation surfaces an error and leaves no Pending Invitation behind.
- **Rate limiting.** Sending is limited per inviter and per Workspace by reusing the existing Redis-backed email-request limiter pattern used for authentication emails.
- **Input shape.** One email per submission in v1.
- **UI.** A new members page under each Workspace's settings. All Workspace members see the members list with Display Name and role. Only Owner and Admin see the invite form (email plus Member/Viewer choice) and the Pending Invitations list with Resend and Revoke. The page is inaccessible to non-members. Data is read in Server Components, and mutations are Server Actions that revalidate the page. Only the interactive form and row controls are Client Components.
- **Domain language.** "Pending Invitation" is added to `CONTEXT.md`. The session is recorded in `docs/QnA/workspace-invitations.md`. No new ADR: the choices are easy to reverse and ADR 0009 already covers the role model.

## Testing Decisions

- A good test exercises external behavior through public interfaces: what an Owner, Admin, Member, Viewer or invitee can and cannot do, and what state results. It does not assert on internal helpers, call order or table shapes beyond what a user could observe.
- **Primary seam: the invitation module's public functions**, tested with the existing real-database integration pattern (real Prisma client over the pg adapter, skipping gracefully when the database URL is unset). Mailer and rate limiter are injected as fakes. Cases to cover:
  - Owner and Admin can create; Member, Viewer, non-members and Personal Space containers are rejected.
  - Only Member and Viewer roles are accepted; Admin and Owner are rejected.
  - Already-a-Member is rejected; a pending email is resent instead of duplicated; email casing is normalized.
  - Expiry is 7 days; an expired invitation lists as Expired and cannot be accepted, and resend revives it.
  - Resend invalidates the old token; revoke makes the token resolve as invalid.
  - Email send failure leaves no Pending Invitation; rate limit exceeded blocks sending.
  - Acceptance grants exactly the invited role and no List access; email mismatch is refused; accepted invitations are excluded from the pending list.
- **Secondary seam: a smoke test for the members page**, following the existing colocated `page.smoke.test.tsx` pattern, verifying that Owner and Admin see the invite form and Pending Invitation controls and that Members and Viewers see only the members list.
- **Existing end-to-end spec** for invitations gets one added happy path: invite from the form, follow the emailed link, accept, and appear in the members list. No new end-to-end seam.
- Prior art: the existing invitation flow integration test and unit tests in the Workspace library folder, the authentication email-request limiter integration test, and the existing page smoke tests.

## Out of Scope

- Bulk or multi-email invitations.
- Guest invitations; Guests are granted per List through a separate flow.
- Inviting as Admin or Owner, and changing a member's role or removing a member from this page.
- Pre-assigning Lists at invite time.
- Accepting an invitation under a different email address than the one invited.
- Invitation audit history beyond keeping accepted rows.
- Invitation links that work for several people.

## Further Notes

- Whether Viewers may see the members list was assumed yes, since the list is read-only; revisit if that is wrong.
- The accept side, sign-up email locking and the email template already exist and are not being redesigned.
- Source: wayfinder ticket #55, "Design workspace invitations (backend + UI)".
