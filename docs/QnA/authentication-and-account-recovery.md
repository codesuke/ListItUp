# Grill Session: Authentication and Account Recovery

## Context

Planning ListItUp's initial Better Auth integration: sign-up, sign-in, two-factor authentication, SMTP delivery, and account-recovery emails.

## Questions

### 1. Which sign-in methods should launch together?

**Recommended answer**:

Support email and password plus email magic-link sign-in from day one. Defer social sign-in so the first release can focus on a dependable email-based authentication and recovery flow.

**User answer**:

Recommendation is good.

**Settled outcome**:

ListItUp will launch with email/password and email magic-link sign-in. Social sign-in is deferred.

### 2. How should two-factor authentication apply at launch?

**Recommended answer**:

Make authenticator-app (TOTP) two-factor authentication optional for every User. Include setup, verification, disable, and one-time recovery-code flows. Defer role-based or Workspace-mandated two-factor authentication until Workspace security policies exist.

**User answer**:

Sounds good.

**Settled outcome**:

TOTP two-factor authentication is optional for every User at launch and includes recovery codes. Workspace roles do not require two-factor authentication in the initial release.

### 3. When is an email identity verified and when can a User enter the app?

**Recommended answer**:

Require email verification before a password-created User can enter ListItUp or receive a personal Workspace. A successfully used magic link verifies the email automatically. Defer OAuth, and when it is added, accept only a provider-supplied verified email identity.

**User answer**:

Magic link and OAuth should verify automatically. The recommendation to defer OAuth is fine.

**Settled outcome**:

Password-created accounts require email verification before app access. Magic-link authentication verifies the email automatically. OAuth is deferred; its future integration must use verified provider email identities.

### 4. How should a User change their email address?

**Recommended answer**:

Require the User's current password and, when enabled, a two-factor code. Verify the new address by confirmation link, keep the old address active until that confirmation succeeds, then notify the old address that the change completed.

**User answer**:

Recommendation is good.

**Settled outcome**:

An email-address change requires recent authentication, verification of the replacement address, and a security notification to the previous address after the change completes.

### 5. Does password reset bypass enabled two-factor authentication?

**Recommended answer**:

No. Resetting a password proves control of the email address but must not remove the two-factor requirement. After resetting the password, the User still needs TOTP or a one-time recovery code; any support-assisted recovery must be a separately designed process.

**User answer**:

Recommendation is good.

**Settled outcome**:

Password reset does not bypass enabled two-factor authentication. TOTP or a recovery code remains required, while support-assisted recovery is deliberately separate.

### 6. What happens if a User loses both their authenticator and recovery codes?

**Recommended answer**:

Do not offer support-assisted two-factor recovery in the first release. Make recovery-code download and regeneration clear during setup. A User who loses both factors must create a new identity until a separately designed, strongly verified recovery process exists.

**User answer**:

Recommendation is good.

**Settled outcome**:

The initial release has no manual two-factor recovery. Recovery codes are the supported fallback; losing both factors requires a new identity.

### 7. How should signed-in sessions behave?

**Recommended answer**:

Keep sessions active for 30 days and refresh them during normal use. Let Users sign out of the current device and revoke all other sessions from settings. Revoke every session after a password or email-address change.

**User answer**:

Recommendation is good.

**Settled outcome**:

Sessions last 30 days with rolling renewal. Users can sign out of the current device or all other devices, and every session is revoked after a password or email-address change.

### 8. When are a new User's personal Workspace and Inbox List created?

**Recommended answer**:

Create them after the User's email is verified and they complete their first successful sign-in. This prevents unverified registrations from creating abandoned product data.

**User answer**:

Recommendation is good.

**Settled outcome**:

ListItUp provisions a personal Workspace and Inbox List only after a verified User's first successful sign-in.

### 9. How should ListItUp support Google SMTP, Mailgun, Brevo, and future SMTP providers?

**Recommended answer**:

Use one provider-neutral SMTP mailer, configured through environment variables, with exactly one active provider per environment. Keep provider-specific APIs out of application code. Use Mailgun or Brevo in production and reserve Google SMTP for low-volume development or testing.

**User answer**:

Recommendation is good.

**Settled outcome**:

ListItUp uses a provider-neutral SMTP mailer with one active provider per environment. Mailgun or Brevo are appropriate production choices; Google SMTP is limited to low-volume development or testing.

### 10. Which authentication emails are required at launch?

**Recommended answer**:

Send branded transactional emails for email verification, magic-link sign-in, password reset, email-address change confirmation, email-address changed notice, two-factor enabled or disabled notice, recovery-code regeneration notice, and Workspace invitations. Defer marketing-style welcome email.

**User answer**:

Recommendation is good.

**Settled outcome**:

Launch email includes verification, magic link, password recovery, email change, two-factor change, recovery-code regeneration, and Workspace invitation messages. A marketing welcome email is deferred.

### 11. How long are emailed action links valid?

**Recommended answer**:

Make every link single-use. Expire magic links and password-reset links after 15 minutes, email-verification and email-address-change links after 24 hours, and Workspace invitations after 7 days. Issuing a replacement invalidates the prior link of the same type.

**User answer**:

Recommendation is good.

**Settled outcome**:

All emailed action links are single-use. Magic-link and password-reset links last 15 minutes; verification and email-change links last 24 hours; Workspace invitations last 7 days. A replacement link invalidates its predecessor.

### 12. How should ListItUp prevent account discovery and email abuse?

**Recommended answer**:

Return the same generic confirmation message whether or not an email exists for password-reset, magic-link, and verification-resend requests. Enforce a 60-second resend cooldown plus server-side rate limits by IP address and email address, showing a clear retry-later message only after a limit is reached.

**User answer**:

Recommendation is good.

**Settled outcome**:

Authentication email requests do not reveal whether an email exists. They use a 60-second resend cooldown and server-side IP and email rate limits.

### 13. What password policy should apply?

**Recommended answer**:

Require at least 12 characters, allow long passphrases and password-manager-generated strings, and avoid arbitrary composition rules or mandatory periodic changes. Add known-compromised-password rejection only when a breach-check service is deliberately introduced.

**User answer**:

Recommendation is good.

**Settled outcome**:

Passwords require at least 12 characters. ListItUp supports passphrases and password managers, has no composition or rotation requirement, and defers breached-password checking.

### 14. How should two-factor enrollment complete?

**Recommended answer**:

Show a TOTP QR code and manual secret, then require a valid authenticator code before enabling two-factor authentication. Display ten one-time recovery codes exactly once, require confirmation that they were saved, and let a signed-in User regenerate them later. Regeneration invalidates the prior codes and sends a security notice.

**User answer**:

Recommendation is good.

**Settled outcome**:

Two-factor enrollment requires TOTP verification and then presents ten recovery codes once. Setup requires saved-code confirmation; regeneration invalidates the old codes and sends a security notification.

### 15. How should disabling two-factor authentication work?

**Recommended answer**:

Require recent authentication with the current password plus either a valid TOTP code or an unused recovery code. When two-factor authentication is disabled, invalidate all remaining recovery codes, revoke other active sessions, keep the current session, and send a security notice email.

**User answer**:

Recommendation is good.

**Settled outcome**:

Disabling two-factor authentication requires password reauthentication plus TOTP or recovery-code proof. Disabling invalidates recovery codes, revokes other sessions, keeps the current session, and sends a security notice.

### 16. Should ListItUp support trusted devices for two-factor authentication?

**Recommended answer**:

Do not support "remember this device" in the first release. Require two-factor authentication on each new sign-in when enabled, including email/password and magic-link sign-in. The 30-day session keeps normal use smooth after successful verification.

**User answer**:

Recommendation is good.

**Settled outcome**:

Trusted-device bypass is out of scope for the first release. A User with two-factor authentication enabled must complete the second factor for every new sign-in method, including magic-link sign-in.

### 17. Can a magic link create a new User?

**Recommended answer**:

No. In the first release, magic links only sign in an existing User. New Users must use the sign-up flow so ListItUp can collect the minimum profile fields, verify intent, and provision the personal Workspace at the right time. If someone requests a magic link for an unknown email, show the same generic confirmation message but do not create a User.

**User answer**:

Recommendation is good.

**Settled outcome**:

Magic links are sign-in only. Unknown email addresses receive the generic request confirmation, but ListItUp does not create a User from a magic-link request.

### 18. What fields should sign-up collect?

**Recommended answer**:

Collect only Display Name, Email, and Password. Display Name is non-unique, editable later, and used for membership and activity labels; email is the identity; password follows the 12-character rule. Do not ask for Workspace name at sign-up because the personal Workspace can use a default label and team Workspaces come later.

**User answer**:

Recommendation is good.

**Settled outcome**:

Sign-up collects Display Name, Email, and Password only. Display Name is non-unique and editable later; Workspace naming is not part of sign-up.

### 19. What auth pages should exist in the first release?

**Recommended answer**:

Create `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/two-factor`, and `/settings/security`. Keep magic-link request on `/sign-in` as an alternate sign-in method instead of making a separate page. Keep two-factor setup, disable, and recovery-code management inside `/settings/security`.

**User answer**:

Recommendation is good.

**Settled outcome**:

The first auth surface includes sign-in, sign-up, password recovery, email verification, two-factor challenge, and security settings routes. Magic-link request is part of sign-in; two-factor management lives in security settings.

### 20. Where should a User land after authentication succeeds?

**Recommended answer**:

Send every successful sign-in to My Tasks. On a verified User's first successful sign-in, provision the personal Workspace and Inbox List first, then land them in My Tasks with the Inbox available as the capture destination. If they started from a Workspace invitation, accept the invite after authentication and land them in that Workspace instead.

**User answer**:

Recommendation is good.

**Settled outcome**:

Successful authentication lands in My Tasks by default. First verified sign-in provisions the personal Workspace and Inbox List first. Workspace invitation flows complete the invite and land the User in the invited Workspace.

### 21. How should Workspace invitation authentication work?

**Recommended answer**:

Invitation links carry the intended email and invite token. If the email already belongs to a User, they sign in and the invite is accepted. If not, they sign up with that email locked, verify it, then the invite is accepted and they land in the Workspace. If they sign in as a different User, block acceptance and explain that the invite was sent to another email.

**User answer**:

Recommendation is good.

**Settled outcome**:

Workspace invitations are tied to the invited email address. Existing Users authenticate to accept; new Users sign up with the invited email locked, verify it, then accept. A different signed-in User cannot accept the invite.

### 22. How should OAuth fit when it is added later?

**Recommended answer**:

Keep OAuth out of the first implementation, but reserve the workflow now. Future OAuth sign-in should create a User only from a provider-verified email, skip password setup, mark the email verified, and still require a two-factor challenge if the User has enabled two-factor authentication. If the provider email matches an existing User, link the provider only after that User is already authenticated.

**User answer**:

Recommendation is good.

**Settled outcome**:

OAuth is deferred. Future OAuth must rely on provider-verified email identities, may create verified Users without passwords, must not bypass enabled two-factor authentication, and links to existing Users only after the User is already authenticated.

### 23. How should authentication emails identify the sender?

**Recommended answer**:

Use one environment-level sender identity, `EMAIL_FROM`, formatted like `ListItUp <auth@your-domain>`. Use the same sender for verification, magic links, password reset, two-factor notices, and Workspace invitations. Provider credentials vary by environment, but the app should not hardcode Google, Mailgun, or Brevo sender details.

**User answer**:

Recommendation is good.

**Settled outcome**:

Authentication and invitation emails use one configured sender identity per environment. SMTP provider details remain environment configuration and are not hardcoded into product workflows.

### 24. What should happen when email delivery fails?

**Recommended answer**:

Log the failure server-side with message type and provider error, show a generic "could not send right now" message, and allow retry after the normal cooldown. Do not create fake success for critical flows like verification or password reset if the provider call clearly failed; the User needs a truthful retry path without exposing account existence.

**User answer**:

Recommendation is good.

**Settled outcome**:

Email delivery failures are logged server-side and shown to Users as generic retryable send failures. Critical flows do not pretend delivery succeeded when the SMTP provider clearly failed.

### 25. How should authentication email templates be managed?

**Recommended answer**:

Keep templates in code as typed transactional templates, with shared layout, subject, preview text, and plain-text fallback for each email. Do not store editable templates in the database for the first release; that adds an admin surface and review problem before it is needed.

**User answer**:

Recommendation is good.

**Settled outcome**:

Authentication emails are code-owned transactional templates with shared layout, subject, preview text, and plain-text fallback. Database-editable templates are out of scope for the first release.

### 26. What can an unverified password-created User do?

**Recommended answer**:

They cannot enter the app, receive a personal Workspace, or accept Workspace invitations yet. They can view `/verify-email`, request a verification resend after cooldown, sign out, or abandon the flow. Once verified, their next successful sign-in provisions the personal Workspace and continues any pending invite.

**User answer**:

Recommendation is good.

**Settled outcome**:

Unverified password-created Users are limited to verification, resend, and sign-out flows. Product access, personal Workspace provisioning, and Workspace invitation acceptance require verification first.

### 27. Should unverified sign-ups expire?

**Recommended answer**:

Yes. Keep unverified Users for 7 days, allowing verification resends during that window. After 7 days, mark them expired or delete the pending auth identity if no product data exists. This prevents abandoned registrations from permanently reserving an email before the User ever enters ListItUp.

**User answer**:

Recommendation is good.

**Settled outcome**:

Unverified sign-ups remain available for 7 days. After that, ListItUp may expire or remove the pending identity when no product data exists.

### 28. How should sign-up handle an email that already belongs to a User?

**Recommended answer**:

Show the same generic post-submit message: "If this email can be used, we'll send the next step." If the User is verified, send a sign-in or password-reset oriented email instead of creating another User. If unverified and still inside the 7-day window, resend verification subject to cooldown. This avoids account discovery while giving the real owner a useful path.

**User answer**:

Recommendation is good.

**Settled outcome**:

Duplicate sign-up attempts do not reveal whether the email already exists. Verified Users receive a useful sign-in or recovery path; unverified Users inside the retention window receive verification resend behavior subject to cooldown.

### 29. How should protected app routes behave when a User is not fully authenticated?

**Recommended answer**:

Unauthenticated Users are redirected to `/sign-in` with a return URL. Unverified Users are redirected to `/verify-email`. Users who passed the first factor but still need two-factor authentication are redirected to `/two-factor`. After the required step succeeds, return them to the original URL unless an invitation flow overrides the destination.

**User answer**:

Recommendation is good.

**Settled outcome**:

Protected routes route incomplete authentication states to the required next step: sign-in, email verification, or two-factor challenge. Successful completion returns the User to the intended URL unless a Workspace invitation controls the destination.

### 30. What should the security settings page include at launch?

**Recommended answer**:

Show email address, password change, active sessions with "sign out other sessions," two-factor authentication status and setup/disable controls, recovery-code regeneration, and email-change flow. Defer audit-log UI, OAuth provider management, and Workspace security policies until those features exist.

**User answer**:

Recommendation is good.

**Settled outcome**:

Security settings include email, password, sessions, two-factor authentication, recovery-code regeneration, and email-change controls. Audit logs, OAuth provider management, and Workspace security policies are deferred.

### 31. Should the first release support deleting a User account?

**Recommended answer**:

Defer full account deletion from this authentication slice. Add sign-out, session revocation, password and email changes, and two-factor controls first. Deletion touches Workspace ownership, shared Items, invitations, and data retention, so it should be designed as its own workflow later.

**User answer**:

Recommendation is good.

**Settled outcome**:

User account deletion is out of scope for the first authentication release and will be designed separately with Workspace and data-retention rules.

### 32. How should failed sign-in attempts be handled?

**Recommended answer**:

Avoid permanent account lockouts. Apply progressive rate limits by IP address and email address after repeated failed password or two-factor attempts, show a generic retry-later message, and send a security notice only when there is a strong signal like many failures against a verified User. Magic-link and reset requests stay under the existing email cooldown and rate limits.

**User answer**:

Recommendation is good.

**Settled outcome**:

Failed password and two-factor attempts use progressive IP and email rate limits, not permanent lockouts. Security notices are reserved for strong suspicious-activity signals against verified Users.

### 33. What observable implementation slices should we plan?

**Recommended answer**:

Split the work into vertical slices in this order: Better Auth foundation and database schema, SMTP mailer and templates, sign-up with verification, sign-in with password and magic link, protected-route state handling, password reset, two-factor setup and challenge with recovery codes, security settings, Workspace invitation authentication, then production SMTP provider configuration docs. Each slice should pair UI and backend utilities so it produces a testable User workflow.

**User answer**:

Sounds good. Take the things in a simple flow; making UI and backend utilities together is a good decision.

**Settled outcome**:

The authentication work will be planned as simple vertical slices that pair the page/UI, backend utilities, email behavior, and behavior tests for each workflow.

## Date

2026-07-11

## Follow-Ups

- Glossary updates: Added Display Name. Updated personal Workspace provisioning to happen after verified first sign-in.
- ADRs created: None yet.
- Specs affected: Future authentication and account-recovery PRD.

## Amendment (2026-07-11)

Question 16's settled outcome is revised: magic-link sign-in no longer requires the second factor, even when a User has two-factor authentication enabled. A magic link already proves the User controls the invited inbox, and that is treated as a sufficient sign-in factor on its own for this product — implementing a second, hand-rolled 2FA challenge for magic-link sign-in (parallel to Better Auth's own password-sign-in mechanism) added real complexity for marginal benefit.

- **Magic link → signs in directly**, even when 2FA is enabled.
- **Password sign-in → still requires TOTP/recovery code** when 2FA is enabled (unchanged).

Trade-off, made explicit: 2FA now protects password sign-ins specifically, not an already-compromised email inbox. See `docs/ADR/0003-magic-link-two-factor-bridge.md` (superseded) for the mechanism this replaced.
