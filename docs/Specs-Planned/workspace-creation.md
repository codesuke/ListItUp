## Problem Statement

A User cannot create a shared Workspace. `CONTEXT.md` says a User "may create or join multiple Workspaces", but the only shared Workspaces a User ever gets are the auto-provisioned Demo Workspace and ones they are invited into. There is no way to start a team Workspace of their own, so the invitation, members, settings and ownership-transfer features have nothing to act on unless someone already has a Workspace to administer.

## Solution

A User can create a new shared Workspace by giving it a name. They become its sole Owner, it starts empty (no Lists), and they land on its Home, where they can create Lists and invite people. The entry point is a "Create Workspace" action in the Workspace switcher in the sidebar, which opens a small form (name only) on its own page.

## User Stories

1. As a User, I want to create a shared Workspace by naming it, so that I can start collaborating with a team.
2. As a User, I want a "Create Workspace" action in the Workspace switcher, so that I can find it where I already move between Workspaces.
3. As a User with no other shared Workspaces, I want the switcher's empty state to offer Create Workspace, so that the first step is obvious.
4. As a User, I want to become the Workspace Owner of a Workspace I create, so that I have full authority over it.
5. As a User, I want to land on the new Workspace's Home after creating it, so that I can immediately create a List or invite people.
6. As a User, I want the new Workspace to start with no Lists, so that I decide its structure and am not given a stray Inbox (the Inbox List belongs to the Personal Space).
7. As a User, I want the name trimmed and required, with a sensible maximum length, so that Workspaces are never nameless or unwieldy.
8. As a User, I want a clear inline error for an empty or too-long name, so that I can fix it without losing the form.
9. As a User, I want to create several Workspaces, including ones with the same name as another I belong to, so that naming is never a blocker.
10. As a User, I want the new Workspace to appear in my switcher straight away, so that I can get back to it.
11. As a User, I want the new Workspace to be a normal shared Workspace (not Demo, Peer Comparison off), so that it behaves like any other.
12. As a signed-out visitor, I want the create page and action to be inaccessible, so that Workspaces are only created by authenticated Users.
13. As a User whose email is not yet verified, I want creation refused, so that unverified accounts cannot create shared spaces (consistent with Personal Space provisioning).
14. As a Platform Operator or security reviewer, I want authentication and name validation enforced in the creation function itself, not only in the page, so that a direct Server Action call cannot bypass them.
15. As a developer, I want creation to be atomic (Workspace plus Owner membership together), so that a failure never leaves an ownerless Workspace.
16. As a developer, I want creation to be testable through one public function against the real database, so that behavior can be proven without the UI.

## Implementation Decisions

- **Creation module.** A new `lib/workspace/workspace-creation.ts` exposes `createWorkspace(database, userId, name)`, following the shape of `provisionPersonalWorkspace`. It validates the name, requires an existing User with a verified email, and creates the `SHARED` Workspace and the creator's `OWNER` `WorkspaceMember` in one nested write (one transaction). It returns the new Workspace id (or a typed validation failure — a discriminated result rather than throwing for expected input errors).
- **Name rules.** Trimmed, 1 to 80 characters, defined once as named constants shared by the module and the form's `maxLength`. No uniqueness constraint, per the user stories.
- **Starting state.** `kind: SHARED`, `isDemo: false`, `peerComparisonEnabled` at its default (off), no Lists, no Labels. Only the creator is a member. No Inbox List is created: per `CONTEXT.md`, the Inbox is a Personal Space concept.
- **No limit on count** of Workspaces per User in v1.
- **Schema.** No schema change; the existing `Workspace` and `WorkspaceMember` models suffice, so no migration.
- **Authorization.** Any authenticated, email-verified User may create. Checked inside `createWorkspace`, consistent with the rule that a Server Action is not itself a security boundary.
- **UI.**
  - The switcher in `WorkspaceSidebar` gains a "Create Workspace" link at the foot of its list, and the empty state ("No other Workspaces yet.") links to it too. It uses a `lucide-react` icon per `DESIGN.md`.
  - A new route, `app/workspaces/new/page.tsx`, is a Server Component that requires a session (reusing the existing protected-route redirect) and renders a small form. Because it is outside any `[workspaceId]` layout, it renders a minimal shell with a back link rather than the sidebar. Check `workspaces/new` does not collide with the `[workspaceId]` dynamic segment — a static segment takes precedence, which is the intended behavior.
  - The form's mutation is a Server Action that calls `createWorkspace`, then `revalidatePath` for the layout so the switcher updates, then redirects to `/workspaces/<id>`. Only the form's pending/error state needs a Client Component.
  - Visual styling follows `DESIGN.md` and `sample.html`.
- **Domain language.** No new terms. The `CONTEXT.md` **Workspace** entry already says a User may create or join multiple Workspaces; no change needed. No ADR: the decisions are easy to reverse.

## Testing Decisions

- A good test exercises behavior through the public interface: who can create, what state results. It does not assert on call order or internals.
- **Primary seam: `createWorkspace`**, tested with the existing real-database integration pattern (real Prisma client over the pg adapter, skipping gracefully when the database URL is unset). Cases:
  - Creating returns an id; the Workspace is `SHARED`, not Demo, with the given trimmed name.
  - The creator is the only member and holds the `OWNER` role.
  - The Workspace has no Lists (no Inbox).
  - Empty, whitespace-only and over-length names are rejected and create nothing.
  - An unknown User and an unverified-email User are rejected and create nothing.
  - Two creations with the same name both succeed and are distinct.
  - The new Workspace appears in the creator's switcher query (`SHARED` containers they belong to) and never in another User's.
- **Secondary seam: smoke test for `app/workspaces/new/page`** (colocated `page.smoke.test.tsx`), verifying that a signed-in User sees the form and a signed-out visitor is redirected.
- **Existing sidebar/layout smoke test** gains one assertion that the switcher offers Create Workspace, in both the populated and empty states.
- Prior art: `workspace-provisioning.test.ts`, `demo-workspace.test.ts`, `list-creation.integration.test.ts`, and the existing page smoke tests.

## Out of Scope

- Workspace deletion, archiving, renaming and ownership transfer (settings and transfer already exist or are separate work).
- Workspace avatars/icons, descriptions and templates.
- Inviting members during creation; invitations are done afterwards from the members page.
- Seeding starter Lists or sample content (that is the Demo Workspace's job).
- Per-User limits on the number of Workspaces, and billing or plan gating.
