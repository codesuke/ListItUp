import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";

import type { PrismaClient } from "@/generated/prisma/client";
import type { Mailer } from "@/lib/mailer/mailer-core";
import {
  MAGIC_LINK_EXPIRES_IN_MINUTES,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_EXPIRES_IN_MINUTES,
  PASSWORD_RESET_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  THIRTY_DAYS_IN_SECONDS,
  TWO_FACTOR_ISSUER,
  TWO_FACTOR_TOTP_DIGITS,
  TWO_FACTOR_TOTP_PERIOD_SECONDS,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  VERIFICATION_TOKEN_EXPIRES_IN_HOURS,
  VERIFICATION_TOKEN_EXPIRES_IN_SECONDS,
} from "@/lib/auth/auth-config";
import { emailChangeEmail } from "@/lib/mailer/email-templates/email-change";
import { emailChangedNoticeEmail } from "@/lib/mailer/email-templates/email-changed-notice";
import { magicLinkEmail } from "@/lib/mailer/email-templates/magic-link";
import { passwordResetEmail } from "@/lib/mailer/email-templates/password-reset";
import { verificationEmail } from "@/lib/mailer/email-templates/verification";
import { invalidateOtherMagicLinkTokens } from "@/lib/auth/magic-link-tokens";
import { invalidateOtherPasswordResetTokens } from "@/lib/auth/password-reset-tokens";
import {
  clearPendingEmailChange,
  resolvePendingEmailChange,
} from "@/lib/auth/pending-email-change";
import {
  recordVerificationEmailSent,
  resendVerificationEmailIfAllowed,
} from "@/lib/auth/verification-resend";
import { provisionPersonalWorkspace } from "@/lib/workspace/workspace-provisioning";

export function createAuth(database: PrismaClient, mailer: Mailer) {
  async function sendVerificationEmail(email: string, url: string) {
    // Better Auth's changeEmail endpoint reuses this same callback (with
    // `email` set to the new address) rather than exposing a separate hook,
    // so this is also the one place that can tell an email-change
    // verification apart from an ordinary sign-up verification.
    const pendingChange = await resolvePendingEmailChange(database, email);
    const result = await mailer.send({
      to: email,
      type: pendingChange ? "email-change" : "verification",
      template: pendingChange
        ? emailChangeEmail({
            confirmUrl: url,
            newEmail: email,
            expiresInHours: VERIFICATION_TOKEN_EXPIRES_IN_HOURS,
          })
        : verificationEmail({
            verifyUrl: url,
            expiresInHours: VERIFICATION_TOKEN_EXPIRES_IN_HOURS,
          }),
    });

    if (!result.ok) {
      throw new Error(`Failed to send verification email to ${email}`);
    }

    // Every real send funnels through here (initial send-on-sign-up and
    // every resend path), so this is the single place to record the
    // cooldown timestamp used by resendVerificationEmailIfAllowed.
    await recordVerificationEmailSent(database, email);
  }

  async function sendEmailChangedNotice(oldEmail: string, newEmail: string) {
    await mailer.send({
      to: oldEmail,
      type: "email-changed-notice",
      template: emailChangedNoticeEmail({ newEmail }),
    });
  }

  async function sendMagicLinkEmail(email: string, url: string, token: string) {
    await invalidateOtherMagicLinkTokens(database, email, token);

    const result = await mailer.send({
      to: email,
      type: "magic-link",
      template: magicLinkEmail({
        magicLinkUrl: url,
        expiresInMinutes: MAGIC_LINK_EXPIRES_IN_MINUTES,
      }),
    });

    if (!result.ok) {
      throw new Error(`Failed to send magic link email to ${email}`);
    }
  }

  async function sendPasswordResetEmail(
    email: string,
    url: string,
    userId: string,
    token: string
  ) {
    await invalidateOtherPasswordResetTokens(database, userId, token);

    const result = await mailer.send({
      to: email,
      type: "password-reset",
      template: passwordResetEmail({
        resetUrl: url,
        expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
      }),
    });

    if (!result.ok) {
      throw new Error(`Failed to send password reset email to ${email}`);
    }
  }

  const auth = betterAuth({
    appName: "ListItUp",
    database: prismaAdapter(database, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_IN_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        await sendPasswordResetEmail(user.email, url, user.id, token);
      },
      onExistingUserSignUp: async ({ user }) => {
        if (user.emailVerified) {
          return;
        }

        await resendVerificationEmailIfAllowed(
          database,
          async (email) => {
            await auth.api.sendVerificationEmail({ body: { email } });
          },
          user.email
        );
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(user.email, url);
      },
      expiresIn: VERIFICATION_TOKEN_EXPIRES_IN_SECONDS,
      autoSignInAfterVerification: true,
    },
    session: {
      expiresIn: THIRTY_DAYS_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    user: {
      changeEmail: { enabled: true },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await provisionPersonalWorkspace(database, session.userId);
          },
        },
      },
      user: {
        update: {
          after: async (user, context) => {
            const pending = await resolvePendingEmailChange(
              database,
              user.email
            );
            if (!pending || pending.userId !== user.id) {
              return;
            }

            await clearPendingEmailChange(database, user.email);
            await sendEmailChangedNotice(pending.oldEmail, user.email);

            // "Every session is revoked after ... an email-address change"
            // (docs/QnA) — including the one that just verified, since
            // Better Auth's own verify-email handler already committed its
            // own (now-stale) session cookie for this request by this
            // point; the User simply signs in again with the new address.
            if (context) {
              await context.context.internalAdapter.deleteUserSessions(user.id);
            }
          },
        },
      },
    },
    rateLimit: {
      customRules: {
        "/send-verification-email": {
          window: VERIFICATION_RESEND_COOLDOWN_SECONDS,
          max: 1,
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
        disableSignUp: true,
        sendMagicLink: async ({ email, url, token }) => {
          await sendMagicLinkEmail(email, url, token);
        },
      }),
      twoFactor({
        issuer: TWO_FACTOR_ISSUER,
        totpOptions: {
          digits: TWO_FACTOR_TOTP_DIGITS,
          period: TWO_FACTOR_TOTP_PERIOD_SECONDS,
        },
        backupCodeOptions: { storeBackupCodes: "encrypted" },
      }),
      // nextCookies must be last so it can persist the cookies plugins set above.
      nextCookies(),
    ],
  });

  return auth;
}
