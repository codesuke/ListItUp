# Authentication and Account Recovery

## Problem Statement

ListItUp needs a dependable authentication foundation before Users can safely create personal Workspaces, accept Workspace invitations, or manage security-sensitive account changes. The current app has no implemented sign-up, sign-in, email verification, password recovery, magic-link sign-in, two-factor authentication, SMTP delivery, or security settings workflow.

The work must be planned as simple vertical flows where each User-facing page, backend utility, transactional email, and behavior test lands together.

## Solution

Build the first authentication release on Better Auth with email/password sign-up, email magic-link sign-in, email verification, password reset, optional TOTP two-factor authentication, one-time recovery codes, provider-neutral SMTP delivery, and security settings.

New password-created Users must verify their email before entering ListItUp or receiving a personal Workspace. Magic-link sign-in verifies the email automatically but only signs in existing Users. After a verified User's first successful sign-in, ListItUp provisions their personal Workspace and Inbox List, then lands them in My Tasks. Workspace invitation flows may override the landing destination and send the User to the invited Workspace after acceptance.

SMTP support should be provider-neutral: Google SMTP can support low-volume development and testing, while Mailgun or Brevo are appropriate production providers. The app should use one active SMTP configuration and one sender identity per environment.

## User Stories

1. As a new User, I want to sign up with Display Name, Email, and Password, so that I can create my ListItUp identity with minimal ceremony.
2. As a new User, I want to receive an email verification link after sign-up, so that ListItUp can confirm I control my email address.
3. As an unverified User, I want to resend my verification email after a cooldown, so that I can recover from a missing or expired email.
4. As an unverified User, I want to see a clear verification-required screen, so that I know why I cannot enter the app yet.
5. As an unverified User, I want to sign out from the verification screen, so that I am not trapped in the flow.
6. As a verified User signing in for the first time, I want my personal Workspace and Inbox List provisioned automatically, so that I can start capturing Items immediately.
7. As a signed-in User, I want to land in My Tasks by default, so that I see the work queue that matters first.
8. As an existing User, I want to sign in with email and password, so that I can access ListItUp through a familiar flow.
9. As an existing User, I want to request a magic link from the sign-in page, so that I can sign in without typing my password.
10. As an existing User, I want magic-link sign-in to verify my email automatically, so that the email-control proof is not duplicated.
11. As someone entering an unknown email for a magic link, I want a generic confirmation message, so that account existence is not exposed.
12. As a User who forgot my password, I want to request a password reset email, so that I can recover access.
13. As a User resetting my password, I want the reset link to be single-use and short-lived, so that recovery does not create a long-lived security risk.
14. As a User with two-factor authentication enabled, I want password reset to keep my second-factor requirement, so that email access alone cannot bypass 2FA.
15. As a User, I want to set a password with at least 8 characters and no arbitrary composition rules, so that passphrases and password managers work well.
16. As a User, I want to change my password from security settings, so that I can maintain account security.
17. As a User, I want password or email changes to revoke active sessions, so that stale sessions cannot keep access after a sensitive change.
18. As a User, I want to enable authenticator-app 2FA by scanning a QR code or entering a manual secret, so that I can secure my account.
19. As a User enabling 2FA, I want to confirm a valid authenticator code before 2FA turns on, so that setup cannot complete with an unusable secret.
20. As a User enabling 2FA, I want to receive ten one-time recovery codes exactly once, so that I have a fallback if my authenticator is unavailable.
21. As a User enabling 2FA, I want to confirm that I saved my recovery codes, so that I understand they are required for fallback access.
22. As a User with 2FA enabled, I want every new sign-in method to require the second factor, so that magic links and password sign-in follow the same security rule.
23. As a User with 2FA enabled, I want to use either a TOTP code or an unused recovery code during sign-in, so that I can still access my account if my authenticator is unavailable.
24. As a User, I want to regenerate recovery codes from security settings, so that I can replace codes that may be lost or exposed.
25. As a User regenerating recovery codes, I want old codes invalidated and a security notice sent, so that there is only one valid recovery-code set.
26. As a User, I want to disable 2FA only after password reauthentication and TOTP or recovery-code proof, so that disabling 2FA is protected.
27. As a User disabling 2FA, I want remaining recovery codes invalidated, other sessions revoked, and a notice email sent, so that I can detect unexpected security changes.
28. As a User, I want to see active session controls, so that I can sign out of other devices.
29. As a User, I want 30-day rolling sessions, so that normal use remains smooth without frequent sign-ins.
30. As a User changing my email address, I want to verify the new email before it replaces the old one, so that my account does not move to an address I do not control.
31. As a User changing my email address, I want my old email notified after success, so that I can detect unexpected account changes.
32. As a Workspace invitee with an existing User identity, I want to authenticate and accept the invitation, so that I can enter the invited Workspace.
33. As a Workspace invitee without a User identity, I want to sign up with the invited email locked, verify it, and then accept the invitation, so that the invitation goes to the intended person.
34. As a signed-in User, I want ListItUp to block accepting an invite sent to another email, so that Workspace access cannot be claimed by the wrong identity.
35. As a User requesting auth emails, I want generic confirmation messages where account existence is sensitive, so that my account cannot be discovered.
36. As a User, I want clear retry messages when email sending fails, so that I know to try again without learning whether another email address exists.
37. As an operator, I want email delivery failures logged with message type and provider error, so that provider problems can be diagnosed.
38. As an operator, I want one SMTP mailer that supports Google SMTP, Mailgun, Brevo, and future SMTP providers, so that provider choice stays deploy-time configuration.
39. As an operator, I want one configured sender identity per environment, so that transactional email has consistent branding.
40. As a future implementer, I want OAuth deferred but reserved, so that a later provider login can use verified provider emails without weakening 2FA.

## Implementation Decisions

- Implement the work as vertical slices, pairing UI, backend utilities, transactional email behavior, and tests in each slice.
- Use Better Auth as the authentication foundation and persist its required auth state in the application database.
- Launch with email/password and magic-link sign-in. Defer OAuth implementation.
- Magic links only sign in existing Users. Unknown email addresses receive the generic request confirmation and do not create Users.
- Password-created Users require email verification before product access, personal Workspace provisioning, or Workspace invitation acceptance.
- A successfully used magic link verifies the User's email automatically.
- OAuth, when added later, must use provider-verified email identities, must not bypass enabled 2FA, and may link to an existing User only after that User is already authenticated.
- Sign-up collects Display Name, Email, and Password only. Display Name is non-unique and editable later.
- Passwords require at least 8 characters, with no composition rules, no forced rotation, and no breached-password check in the first release.
- Unverified sign-ups remain available for 7 days. After that, ListItUp may expire or remove the pending identity when no product data exists.
- Duplicate sign-up attempts do not reveal whether an email exists. Verified Users receive a useful sign-in or recovery path; unverified Users inside the retention window receive verification resend behavior subject to cooldown.
- After first verified sign-in, ListItUp provisions the User's personal Workspace and Inbox List, then lands them in My Tasks.
- Normal successful sign-in lands in My Tasks. Workspace invitation flows may override this destination and land in the invited Workspace.
- Protected routes redirect incomplete auth states to the required next step: sign-in, email verification, or two-factor challenge. Successful completion returns to the intended URL unless a Workspace invitation controls the destination.
- The first release auth routes are sign-in, sign-up, forgot-password, reset-password, verify-email, two-factor challenge, and security settings.
- Magic-link request lives on sign-in as an alternate sign-in method.
- Security settings include email, password, active sessions, sign out other sessions, 2FA status, setup, disable, recovery-code regeneration, and email-change flow.
- TOTP 2FA is optional for every User at launch. Workspace roles do not require 2FA in this release.
- 2FA enrollment shows a QR code and manual secret, requires a valid TOTP code before enabling, then shows ten one-time recovery codes exactly once.
- 2FA enrollment requires explicit confirmation that recovery codes were saved.
- 2FA applies to every new sign-in when enabled, including password and magic-link sign-in.
- Trusted-device bypass is out of scope for the first release.
- Password reset does not bypass enabled 2FA. After password reset, the User must still complete TOTP or use a recovery code.
- Disabling 2FA requires recent password authentication plus either a valid TOTP code or an unused recovery code.
- Disabling 2FA invalidates all recovery codes, revokes other sessions, keeps the current session, and sends a security notice.
- Recovery-code regeneration invalidates old codes and sends a security notice.
- There is no manual support-assisted 2FA recovery in the first release. Recovery codes are the supported fallback.
- Sessions last 30 days with rolling renewal. Users can sign out of the current session or revoke other sessions.
- Password and email-address changes revoke all sessions.
- Email-address change requires current password and 2FA when enabled, verifies the new address before replacing the old one, and sends a completion notice to the old address.
- Workspace invitation links carry the intended email and token. Existing Users authenticate to accept. New Users sign up with the invited email locked, verify it, then accept.
- A signed-in User whose email does not match the invitation cannot accept it.
- Use a provider-neutral SMTP mailer with exactly one active provider per environment.
- Google SMTP is intended for low-volume development or testing. Mailgun and Brevo are suitable production providers.
- Use one environment-level sender identity for verification, magic link, password reset, email change, 2FA notices, recovery-code notices, and Workspace invitations.
- Transactional email templates are code-owned typed templates with shared layout, subject, preview text, and plain-text fallback.
- Do not store editable email templates in the database in the first release.
- All emailed action links are single-use. Magic-link and password-reset links last 15 minutes, verification and email-change links last 24 hours, and Workspace invitations last 7 days.
- Issuing a replacement action link invalidates the prior link of the same type.
- Password-reset, magic-link, and verification-resend requests use generic messages that do not reveal account existence.
- Email sending uses a 60-second resend cooldown plus server-side rate limits by IP address and email address.
- Failed password and 2FA attempts use progressive IP and email rate limits rather than permanent account lockouts.
- Security notices are sent only for strong suspicious-activity signals against verified Users.
- If the SMTP provider clearly fails on a critical auth flow, ListItUp logs the provider failure and shows a generic retryable failure rather than pretending delivery succeeded.

## Testing Decisions

- Use behavior tests through the highest practical seam for each vertical slice: the User-facing auth workflow, including page state, submitted actions, redirects, persisted auth state, and emitted transactional email intent.
- Prefer one workflow-level seam per slice rather than testing Better Auth internals. Tests should verify observable behavior: redirects, generic messaging, expiry behavior, session revocation, workspace provisioning, and email intent.
- Add focused utility tests where workflow tests would be too indirect: email template rendering, token expiry and replacement rules, provider-neutral SMTP error handling, and rate-limit behavior.
- Test sign-up and verification as one vertical slice: pending User creation, verification email intent, unverified route blocking, verified first sign-in, personal Workspace provisioning, Inbox List creation, and landing in My Tasks.
- Test sign-in as one vertical slice: password sign-in, magic-link request, magic-link consumption, unknown email generic behavior, 2FA challenge redirect when enabled, and return URL handling.
- Test password reset as one vertical slice: generic request messaging, single-use 15-minute reset link, password update, session revocation, and continued 2FA requirement.
- Test 2FA as one vertical slice: enrollment with TOTP verification, recovery-code display and confirmation, challenge success, recovery-code consumption, regeneration, disable flow, security notices, and trusted-device absence.
- Test security settings as one vertical slice: password change, email change, session listing, sign out other sessions, 2FA management, and security notification email intents.
- Test Workspace invitation authentication as one vertical slice: existing User acceptance, new User sign-up with locked invited email, verification before acceptance, destination override, and blocked acceptance for a different signed-in User.
- Existing prior art is limited because the app is still a fresh Next app. New tests should follow the repo rule that product behavior is verified through public interfaces, not implementation details.

## Out of Scope

- OAuth implementation in the first release.
- Trusted-device or "remember this device" 2FA bypass.
- Role-based or Workspace-mandated 2FA policies.
- Support-assisted 2FA recovery.
- Full User account deletion.
- Audit-log UI.
- OAuth provider management UI.
- Workspace security policies.
- Marketing welcome email.
- Database-editable email templates.
- Known-compromised-password checking.
- Private checklists, sub-Items, or unrelated My Tasks decisions.
- Production provider account setup outside application configuration documentation.

## Further Notes

- The first implementation should use the accepted vertical-slice order: Better Auth foundation and database schema, SMTP mailer and templates, sign-up with verification, sign-in with password and magic link, protected-route state handling, password reset, 2FA setup and challenge with recovery codes, security settings, Workspace invitation authentication, and production SMTP provider configuration docs.
- UI should follow ListItUp's calm, compact, operational design direction and avoid marketing-style auth pages.
- The Q&A source for these decisions is the authentication and account recovery grill session.
