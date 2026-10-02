# Grill Session: Workspace Invitations

## Context

Resolving [wayfinder ticket #55](https://github.com/codesuke/ListItUp/issues/55), "Design workspace invitations (backend + UI)". Before this session the accept side existed (`lib/workspace/workspace-invitations.ts`, `/accept-invitation`, the invitation email template, sign-up email locking) but nothing created a `WorkspaceInvitation`, and no workspace members UI existed. ADR 0009 and the domain-model spec already fixed that invite-time roles are Member or Viewer only, and that Guests use a separate List-level flow.

## Questions

### 1. Who can invite?

**Recommended answer**: Workspace Owner and Admin only. Members and Viewers cannot invite. A Personal Space cannot invite.

**User answer**: Agreed, and the invite form must ask whether the person is being invited as a Member or a Viewer.

**Settled outcome**: Owner and Admin invite. The inviter always chooses Member or Viewer in the invite form.

### 2. What does an accepted invitation grant?

**Recommended answer**: Member or Viewer, defaulting to Member. No List access is granted; List membership is a separate later step.

**User answer**: Agreed.

**Settled outcome**: Acceptance grants the chosen Workspace-level role only, never List access.

### 3. Email-matching rules for existing and new users

**Recommended answer**: Strict email matching (case-insensitive, normalized on write), no "accept as a different email". Reject invites to existing Members. A second invite to an email with a pending invitation acts as a resend.

**User answer**: Sounds good.

**Settled outcome**: As recommended.

### 4. Expiry

**Recommended answer**: 7 days, as a named constant also feeding the email's `expiresInDays`. Expired invitations stay listed as Expired with a Resend action.

**User answer**: 7 days works.

**Settled outcome**: As recommended.

### 5. Resend and revoke

**Recommended answer**: Add nullable `invitedById` (`onDelete: SetNull`). Resend rotates the token and resets `expiresAt`. Revoke hard-deletes the row. Accepted invitations remain as history and are excluded from the pending list.

**User answer**: Agreed.

**Settled outcome**: As recommended. Requires a `prisma migrate dev` migration.

### 6. Where does the UI live?

**Recommended answer**: `/workspaces/[workspaceId]/settings/members`. Owner and Admin see the member list, Pending Invitations (resend/revoke) and the invite form.

**User answer**: Sounds good, and yes, Members can see the members list.

**Settled outcome**: Route as recommended. The member list is visible to every Workspace member (assumed to include Viewers, since the list is read-only); only Owner and Admin see the invite form and Pending Invitation controls.

### 7. Input shape and abuse limits

**Recommended answer**: One email per submission in v1. Reuse the Redis email-request limiter per inviter and per Workspace. On SMTP failure, show the error and leave no dangling pending invite.

**User answer**: Okay.

**Settled outcome**: As recommended.
