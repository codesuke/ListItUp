# Magic-Link Two-Factor Bridge (Superseded)

## Status

superseded — see "Superseded" section below. Kept for historical context on why the bridge existed and why it was removed.

## Original Decision

Better Auth's `twoFactor` plugin only gates password sign-in (`/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`) — it has no supported extension point for magic-link sign-in. The auth spec at the time required 2FA on every new sign-in method, including magic link.

To close that gap without depending on Better Auth's private internals, `lib/auth-core.ts` added:

- A `hooks.before` matcher on `/magic-link/verify` that, for a 2FA-enabled User, consumed the magic-link token itself and redirected to `/two-factor?challenge=...` instead of letting Better Auth's handler sign the User in.
- A small custom plugin (`magicLinkTwoFactorBridge`) exposing one endpoint, `/two-factor/complete-magic-link-challenge`, that verified a TOTP or backup code against the same `twoFactor` table Better Auth's own enrollment endpoints write, then created the session using the same public `internalAdapter.createSession` / `setSessionCookie` primitives Better Auth's own endpoints use.
- Its own pending-challenge tracking (`lib/two-factor-challenge.ts`), independent of Better Auth's internal 2FA cookie.

Because Better Auth's backup-code encode/verify functions are declared in its `.d.mts` but not actually exported by the compiled package, `lib/two-factor-verification.ts` reimplements the same "encrypted" storage format — `JSON.stringify(codes)` through `symmetricEncrypt`/`symmetricDecrypt` with the app secret — matching `backupCodeOptions.storeBackupCodes: "encrypted"`. TOTP verification uses `@better-auth/utils/otp`'s `createOTP`, the same primitive Better Auth's own TOTP endpoint uses internally. **This part is unchanged and still in use** — `lib/two-factor-verification.ts` remains the shared TOTP/backup-code verification helper for the security-settings 2FA-disable and email-change reauthentication checks (issues #8/#9). Only the magic-link bridge itself (the hook, the custom endpoint, and `lib/two-factor-challenge.ts`) was removed.

## Superseded

Revised policy: a magic link already proves the User controls the invited inbox, which is treated as a sufficient sign-in factor on its own for this product. Forcing a TOTP/recovery-code check after an already-successful magic-link sign-in added meaningful implementation complexity (a second, hand-rolled challenge mechanism running in parallel with Better Auth's own) for marginal security benefit on a low-risk product.

- **Magic link → signs in directly**, even when 2FA is enabled. No challenge step.
- **Password sign-in → still requires TOTP/recovery code** when 2FA is enabled, via Better Auth's built-in mechanism (unchanged).

The explicit trade-off: 2FA now protects password sign-ins specifically, not an already-compromised email inbox. If an attacker gains control of a User's inbox, they can sign in via magic link without a second factor — this is accepted as reasonable given the product's risk profile. `docs/QnA/authentication-and-account-recovery.md` has been updated to reflect this (see "Two-factor authentication" section).

Removed as part of this reversal: the `hooks.before` matcher on `/magic-link/verify` and the `magicLinkTwoFactorBridge` custom plugin in `lib/auth-core.ts`, and `lib/two-factor-challenge.ts` (its test too). No replacement mechanism is needed — magic-link sign-in reverts to Better Auth's default (unguarded) behavior.
