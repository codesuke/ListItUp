# Grill Session: Workspace Settings Page and Ownership Transfer

## Context

Design ticket under the "Wire up all backend-ready features to the frontend" wayfinder map ([#54](https://github.com/codesuke/ListItUp/issues/54)), resolving [#58](https://github.com/codesuke/ListItUp/issues/58): layout and sections of the new `/workspaces/[id]/settings` page, sidebar entry, who sees it, and ownership-transfer flow details.

The map had already settled: ownership transfer is Owner-only, no new roles, transfer UX is pick-existing-member + typed workspace-name confirmation + email notice to both parties, page lives at `/workspaces/[id]/settings` with a danger zone, linked from the sidebar. This session settles the rest.

Research going in: `lib/workspace/workspace-ownership.ts#transferWorkspaceOwnership` sends no email today — only a generic `workspace-invitation` mailer type/template exists. No workspace-wide permission helper exists (only the List-scoped `lib/permissions/list-access.ts`). Sibling ticket [#55](https://github.com/codesuke/ListItUp/issues/55) owns the actual invite-creation flow/UI. No `leaveWorkspace`, `deleteWorkspace`, or `removeWorkspaceMember` logic exists anywhere in `lib/`. No members-list UI exists anywhere in the app yet.

## Questions

### 1. What belongs in the Danger Zone beyond ownership transfer?

**Recommended answer**:

Ownership transfer only. Leave-workspace, delete-workspace, and remove-member all need new backend logic that doesn't exist yet and aren't in the map's destination list for #54.

**User answer**:

Recommendation is good.

**Settled outcome**:

Danger Zone contains only the ownership-transfer control. Leave/delete-workspace and remove-member are out of scope for this ticket and its implementation slice.

### 2. What sections does the settings page have, and in what order?

**Recommended answer**:

General (workspace name, read-only for now) → Members (current members + roles) → Invite (slot/CTA for #55's UI) → Danger Zone (transfer) last, mirroring the security page's low-to-high-risk ordering.

**User answer**:

Recommendation is good.

**Settled outcome**:

Page sections, top to bottom: General, Members, Invite (hook for #55), Danger Zone. General shows the workspace name read-only — no rename capability exists in `lib/` yet, so none is added here.

### 3. Who can see the settings page at all?

**Recommended answer**:

Owner + Admin only. Member/Viewer get no Settings nav entry and a `notFound()` if they hit the URL directly, matching ADR 0009's Owner/Admin implicit-access pattern.

**User answer**:

Recommendation is good.

**Settled outcome**:

The whole settings page — not just the Danger Zone — is gated to Workspace Owner and Admin. A Member or Viewer hitting the route directly gets `notFound()`, the same pattern `app/workspaces/[workspaceId]/layout.tsx` already uses for non-members.

### 4. Where does the sidebar entry go, and what triggers it?

**Recommended answer**:

A new top-level "Settings" nav item (gear icon) in `WorkspaceSidebar`'s existing top `SidebarGroup` alongside Home/My Tasks/Updates, rendered only when the viewer's workspace role is OWNER or ADMIN.

**User answer**:

Recommendation is good.

**Settled outcome**:

New top-level "Settings" nav entry in `WorkspaceSidebar`, conditionally rendered for OWNER/ADMIN only. This requires threading the current user's workspace role into `layout-data.ts` and down into `WorkspaceSidebar`'s props.

### 5. Is building the ownership-transfer email notice in scope for this implementation ticket?

**Recommended answer**:

Yes. Add a new `workspace-ownership-transfer` `EmailMessageType` and template (modeled on `lib/mailer/email-templates/workspace-invitation.ts`), sent to both the outgoing and incoming owner from the Server Action after `transferWorkspaceOwnership()` succeeds.

**User answer**:

Recommendation is good.

**Settled outcome**:

Build the transfer email now, not as a follow-up. New mailer type + template, sent to both parties on a successful transfer.

### 6. Who is eligible as a transfer target?

**Recommended answer**:

Any existing member, including Viewer — it's the Owner's explicit, confirmed choice, and Owner has no prerequisite-role definition in `CONTEXT.md`.

**User answer**:

Recommendation is good.

**Settled outcome**:

The transfer-target picker lists all current Workspace members regardless of role, including Viewer.

## Date

2026-10-02

## Follow-Ups

- Glossary updates: none — no new domain terms surfaced; page/section naming (General, Danger Zone) is UI structure, not domain vocabulary.
- ADRs created: None. These are scoping/placement decisions within the two-tier role model already settled by ADR 0009, not a new hard-to-reverse architectural choice.
- Specs affected: none existing; this session is the spec for the future implementation task ticket (settings page + ownership transfer + transfer email), to be opened against the #54 map once graduated.
