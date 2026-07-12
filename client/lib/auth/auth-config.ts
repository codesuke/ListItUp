export const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
export const MIN_PASSWORD_LENGTH = 12;
export const VERIFICATION_TOKEN_EXPIRES_IN_HOURS = 24;
export const VERIFICATION_TOKEN_EXPIRES_IN_SECONDS =
  VERIFICATION_TOKEN_EXPIRES_IN_HOURS * 60 * 60;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
export const PERSONAL_WORKSPACE_NAME = "Personal Workspace";
export const INBOX_LIST_NAME = "Inbox";
export const MAGIC_LINK_EXPIRES_IN_MINUTES = 15;
export const MAGIC_LINK_EXPIRES_IN_SECONDS = MAGIC_LINK_EXPIRES_IN_MINUTES * 60;
export const PASSWORD_RESET_EXPIRES_IN_MINUTES = 15;
export const PASSWORD_RESET_EXPIRES_IN_SECONDS =
  PASSWORD_RESET_EXPIRES_IN_MINUTES * 60;
export const TWO_FACTOR_ISSUER = "ListItUp";
// Must match the twoFactor() plugin's totpOptions in auth-core.ts: our
// magic-link 2FA bridge verifies TOTP codes itself (Better Auth's plugin
// only gates password sign-in), so both sides need the same digits/period.
export const TWO_FACTOR_TOTP_DIGITS = 6;
export const TWO_FACTOR_TOTP_PERIOD_SECONDS = 30;
