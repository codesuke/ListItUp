# Authentication Hardening and Platform Operations

## Problem Statement

ListItUp's authentication pages look polished, but release-critical behavior is not proved or consistently enforced. The normal test command omits database-backed authentication coverage; CI has no disposable database, Redis, or SMTP inbox. Authentication rate limits are only partially configured and rely on in-memory defaults. Several email-request actions report success after clear SMTP failures. Invitation email locking and recovery-code acknowledgement are browser-only controls.

ListItUp also needs a secure, durable way to operate authentication as it grows into a subscription product with public web and Android clients: security events, operator alerts, auditable Platform Operator access, and retention rules are currently absent.

## Solution

Make authentication behavior release-verifiable and operationally manageable. `pnpm test` becomes the mandatory behavior suite, with CI running disposable PostgreSQL, Redis, and Mailpit services, committed Prisma migrations, and Playwright journeys. Redis becomes the shared durable store for authentication abuse controls. SMTP failures become truthful, retryable outcomes where email is required, while completed security changes use a durable notification outbox.

Enforce invitation-email binding and recovery-code acknowledgement at the server boundary. Add backend-enforced Platform Operator role assignments and retained security events, with high-signal Discord alerts. Keep the initial operator surface in the current application while preserving a backend boundary suitable for a later dedicated staff client; public web and Android clients never expose Platform Operator capabilities.

## User Stories

1. As a User, I want sign-up, verification, sign-in, and account recovery to be tested before release, so that I can rely on access to my ListItUp identity.
2. As a User, I want password sign-in and magic-link sign-in to behave consistently across application instances, so that scaling the app does not weaken authentication controls.
3. As a User, I want a generic retryable message when ListItUp cannot send a required verification, password-reset, or magic-link email, so that I know when to try again instead of trusting a false confirmation.
4. As a User, I want password-reset and magic-link requests to remain generic about account existence, so that my identity is not exposed through the form.
5. As an unverified User, I want verification resend limits that work after restarts and across instances, so that delivery controls are dependable and fair.
6. As a User, I want repeated email-request abuse to be limited by both recipient and IP address, so that my inbox is protected from automated requests.
7. As a User, I want repeated failed password attempts to receive temporary progressive restrictions rather than permanent lockout, so that I am protected from abuse without losing my identity through a typo or attack.
8. As a User with two-factor authentication, I want repeated invalid TOTP or recovery-code attempts to receive the same temporary progressive protection, so that my second factor cannot be brute-forced.
9. As a verified User, I want a security notice after sustained failed password attempts against my identity, so that I can recognize a likely credential-stuffing attempt.
10. As a new User invited to a Workspace, I want the server to enforce the invitation's email during sign-up, so that the invitation cannot be redirected to a different identity by a forged form request.
11. As an invited User, I want invitation acceptance to continue checking my signed-in email, so that only the intended identity can join the Workspace.
12. As a User enabling two-factor authentication, I want ListItUp to require acknowledgement that I saved my recovery codes, so that enrollment follows the recovery process promised by the interface.
13. As a User who completes a password, email, or two-factor security change, I want the security change to remain effective even if its notice email is temporarily unavailable, so that I am not left in an ambiguous state.
14. As a User, I want ListItUp to retry an undelivered security notice, so that a transient mail-provider failure does not silently erase an important notice.
15. As a Platform Operator, I want high-signal authentication abuse and failed security notices reported to the audited Discord channel, so that I can respond quickly.
16. As a Platform Operator, I want Discord alerts to contain the relevant raw email and IP data, so that incident triage does not require a second lookup.
17. As a Platform Operator, I want repeated alerts deduplicated, so that routine typos and bursts do not overwhelm the incident channel.
18. As a Platform Operator, I want durable, server-side security events, so that Discord is not the only evidence available for an incident.
19. As a Platform Operator, I want my authorization recorded as a revocable role assignment rather than a deployment setting, so that operator access is auditable and can scale beyond one person.
20. As a product operator, I want security-event data deleted after its defined retention period, so that sensitive authentication metadata is not retained indefinitely.
21. As a developer, I want daily cleanup to run through an authenticated scheduled endpoint, so that retention and unverified-identity expiry are observable and testable.
22. As a developer, I want browser tests to retrieve real authentication links from a disposable SMTP inbox, so that email templates, links, redirects, and cookies are proven end to end without using real accounts.
23. As a developer, I want credential rotation and protected environment-variable configuration to be release prerequisites, so that authentication infrastructure does not rely on potentially exposed local or deployment secrets.
24. As a future Android User, I want client applications to use backend-enforced authorization, so that Platform Operator capabilities cannot leak into public clients.
25. As a future staff operator, I want the internal security boundary to support a dedicated staff web client later, so that operational growth does not require redesigning authorization.

## Implementation Decisions

- `pnpm test` is the required full behavior suite. CI provisions ephemeral PostgreSQL, Redis, and Mailpit; applies committed Prisma migrations; then runs linting, type checking, behavior tests, and browser tests. Database-backed tests must fail when their required service is unavailable rather than silently skip.
- PostgreSQL remains the source of truth for product data and the Prisma schema remains the sole source of truth for database changes. New persistence is introduced through schema changes and generated development migrations only.
- Redis is the durable, shared store for authentication rate limits and temporary security controls. Better Auth's process-local rate-limit defaults are not sufficient for these paths.
- Verification, password-reset, and magic-link sends are limited to one per recipient per minute, five per hour, and ten per day, with a separate twenty-per-hour IP limit.
- Password and TOTP failures use recipient/User and IP dimensions. Five failures in 15 minutes impose a 15-minute retry window; repeated windows escalate to 24 hours. Automated controls never permanently lock an account and user-facing responses remain generic.
- A verified User receives one security notice per 24 hours after ten failed password attempts in 24 hours.
- Required authentication-email requests report a generic retryable failure when SMTP delivery clearly fails. Existing-account and unknown-account flows retain generic request semantics.
- Completed security changes are not rolled back merely because their notification cannot be delivered. Each notice is stored in a durable outbox and retried after 5 minutes, 1 hour, and 24 hours. A final failure remains available for Platform Operator follow-up.
- A valid invitation callback is resolved server-side during sign-up. Its invited email replaces any submitted email; read-only UI is only a convenience. Invitation acceptance still independently validates the signed-in User's email.
- Two-factor enrollment confirmation requires an explicit recovery-code-saved acknowledgement as well as a valid TOTP code. This confirms the User's acknowledgement, not impossible proof of offline storage.
- Add backend-enforced, auditable, revocable PlatformRoleAssignment persistence separate from Workspace roles. Restricted server-side administration or seeding grants and revokes it; environment-variable email lists are not authorization.
- Record authentication security events server-side for 90 days, including raw email and IP data needed for investigation. A daily secret-authenticated scheduled endpoint expires those events and expired unverified identities.
- Send high-signal events to a configured server-only Discord webhook: ten failed password attempts for a User, a 24-hour escalated restriction, and a failed notice for a completed security change. Deduplicate by alert subject for 24 hours. Discord receives raw relevant email/IP data under ADR 0007; webhook/channel access and retention are operational security controls.
- The current application hosts the initial internal operator capability. Authorization and security-event interfaces remain server-side and client-independent so a dedicated staff web client may be introduced later. Public web and Android clients have no Platform Operator capabilities.
- Credential rotation and secret hygiene are release prerequisites. Active local/deployment database and SMTP credentials are rotated where needed, never committed, and supplied through protected environment configuration.
- Magic links continue to sign in directly even when two-factor authentication is enabled, per the accepted trade-off in ADR 0003. Password sign-in continues to require the Better Auth two-factor flow.

## Testing Decisions

- The primary release seam is the real application over HTTP in Playwright, backed by disposable PostgreSQL, Redis, and Mailpit. These tests verify observable User behavior—not implementation calls—including form validation, generic messaging, cookies, redirects, email links, invitation destination handling, two-factor progression, and completed security changes.
- Playwright covers sign-up to verification to password sign-in, enabled-two-factor sign-in, password reset with continued two-factor requirement, magic-link request/consumption, invitation-led sign-up and acceptance, rate-limit responses, SMTP-failure messaging, and recovery-code acknowledgement rejection/acceptance.
- Mailpit is the test SMTP service. Tests retrieve the actual sent verification, reset, and magic links through its API; no real mailbox or SMTP provider is used.
- Existing focused unit and integration tests remain useful for deterministic token, callback URL, workspace-provisioning, two-factor-verification, invitation, mail-template, and outbox/rate-limit behavior. They must use a real disposable database when persistence is part of the observable behavior.
- CI must prove migrations can create the full authentication schema before executing behavior tests. Tests requiring PostgreSQL or Redis must fail clearly if configuration is missing; they may not log a skip and pass.
- Security-event, Discord, and scheduled-cleanup integrations are tested through stable server-side boundaries using a fake webhook transport and controlled clock/service dependencies. Tests assert deduplication, payload policy, retries, retention, and authorization outcomes without calling Discord.
- Existing colocated auth, workspace, session, two-factor, and mail tests provide prior art; the new browser suite is the highest-level release seam and supplements rather than replaces those focused tests.

## Out of Scope

- OAuth, social sign-in, trusted-device two-factor bypass, Workspace-mandated two-factor policies, support-assisted two-factor recovery, account deletion, and a customer-facing audit-log UI.
- A dedicated staff/admin Next.js application, native Android implementation, mobile push notification infrastructure, subscription/billing implementation, and broader support tooling.
- Permanent account lockouts, breached-password checking, and a broad event-streaming platform.
- Changing the accepted policy that a magic link bypasses TOTP.
- Making Discord a public or customer-visible integration; it is solely an audited Platform Operator alert channel.

## Further Notes

- This spec implements the decisions captured in the authentication-and-account-recovery Q&A and ADRs 0003, 0005, 0006, and 0007.
- Platform Operator is a glossary term distinct from Workspace Admin. Workspace membership never grants platform-wide access.
- The planned work should be delivered as thin vertical slices in dependency order: test infrastructure; shared Redis controls and security events; truthful email/outbox behavior; invitation and two-factor enforcement; browser journeys; Platform Operator alerting and cleanup.
- The currently inspected local production environment file is ignored by Git rather than tracked. Its active values still require rotation if real, and deployment secrets must be kept outside repository and build artifacts.
