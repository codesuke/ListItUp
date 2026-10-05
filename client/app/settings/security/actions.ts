"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import QRCode from "qrcode";

import { deleteAccount } from "@/lib/auth/account-deletion";
import { auth, securityAlertService } from "@/lib/auth/auth";
import { VERIFICATION_TOKEN_EXPIRES_IN_HOURS } from "@/lib/auth/auth-config";
import { getAuthSecret } from "@/lib/auth/auth-secret";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import {
  clearPendingEmailChange,
  recordPendingEmailChange,
} from "@/lib/auth/pending-email-change";
import { prisma } from "@/lib/prisma";
import { enqueueAndDeliverSecurityNotice } from "@/lib/security/security-notice-outbox";
import { mailer } from "@/lib/mailer/mailer";
import {
  verifyAndConsumeBackupCode,
  verifyStoredTotpCode,
} from "@/lib/two-factor/two-factor-verification";
import { hasSavedRecoveryCodesAcknowledgement } from "@/lib/two-factor/two-factor-enrollment";

export type EnableTwoFactorState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "awaiting-confirmation";
      qrCodeDataUrl: string;
      manualSecret: string;
      backupCodes: string[];
    };

function extractTotpSecret(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export async function enableTwoFactorAction(
  _prevState: EnableTwoFactorState,
  formData: FormData
): Promise<EnableTwoFactorState> {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { status: "error", message: "Enter your password." };
  }

  try {
    const result = await auth.api.enableTwoFactor({
      body: { password },
      headers: await headers(),
    });
    const qrCodeDataUrl = await QRCode.toDataURL(result.totpURI, {
      margin: 1,
    });

    return {
      status: "awaiting-confirmation",
      qrCodeDataUrl,
      manualSecret: extractTotpSecret(result.totpURI),
      backupCodes: result.backupCodes,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "Incorrect password." };
    }

    throw error;
  }
}

export type ConfirmTwoFactorState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function confirmTwoFactorEnrollmentAction(
  _prevState: ConfirmTwoFactorState,
  formData: FormData
): Promise<ConfirmTwoFactorState> {
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return {
      status: "error",
      message: "Enter the code from your authenticator app.",
    };
  }

  if (!hasSavedRecoveryCodesAcknowledgement(formData)) {
    return {
      status: "error",
      message: "Confirm that you saved your recovery codes.",
    };
  }

  const requestHeaders = await headers();
  // A successful TOTP confirmation makes Better Auth reissue the session
  // cookie, so this is the last point the pre-rotation session can be read
  // reliably — both for the notice below and to avoid the page's own
  // post-action re-render seeing an already-rotated-away session.
  const session = await auth.api.getSession({ headers: requestHeaders });

  try {
    await auth.api.verifyTOTP({
      body: { code },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "That code didn't work. Try again." };
    }

    throw error;
  }

  if (session) {
    await enqueueAndDeliverSecurityNotice(
      prisma,
      mailer,
      {
        recipient: session.user.email,
        type: "two-factor-notice",
        action: "enabled",
      },
      securityAlertService
    );
  }

  // Redirect rather than returning client state: the reissued session
  // cookie above needs its own fresh request to take effect, and an
  // explicit redirect (unlike a plain returned state) sends the browser
  // there instead of re-rendering this page against the now-stale cookie.
  redirect("/settings/security");
}

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return {
      status: "error",
      message: "Enter your current and new password.",
    };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
    };
  }

  try {
    await auth.api.changePassword({
      // Revoking every other session on a password change is a settled
      // product decision (docs/QnA), not a User choice.
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "Incorrect current password." };
    }

    throw error;
  }

  await enqueueAndDeliverSecurityNotice(
    prisma,
    mailer,
    {
      recipient: session.user.email,
      type: "password-changed-notice",
    },
    securityAlertService
  );

  revalidatePath("/settings/security");

  return { status: "success" };
}

export type RequestEmailChangeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent" };

async function verifyInlineTwoFactorCode(
  userId: string,
  code: string
): Promise<boolean> {
  const twoFactorRow = await prisma.twoFactor.findFirst({
    where: { userId },
  });
  if (!twoFactorRow) {
    return false;
  }

  const secretKey = getAuthSecret();

  if (await verifyStoredTotpCode(twoFactorRow.secret, code, secretKey)) {
    return true;
  }

  const backupResult = await verifyAndConsumeBackupCode(
    twoFactorRow.backupCodes,
    code,
    secretKey
  );

  if (backupResult.ok && backupResult.updatedEncryptedBackupCodes) {
    await prisma.twoFactor.update({
      where: { id: twoFactorRow.id },
      data: { backupCodes: backupResult.updatedEncryptedBackupCodes },
    });
  }

  return backupResult.ok;
}

export async function requestEmailChangeAction(
  _prevState: RequestEmailChangeState,
  formData: FormData
): Promise<RequestEmailChangeState> {
  const password = String(formData.get("password") ?? "");
  const newEmail = normalizeEmail(formData.get("newEmail"));
  const twoFactorCode = String(formData.get("twoFactorCode") ?? "").trim();

  if (!password || !newEmail) {
    return {
      status: "error",
      message: "Enter your password and a new email address.",
    };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
    };
  }

  try {
    await auth.api.verifyPassword({
      body: { password },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "Incorrect password." };
    }

    throw error;
  }

  if (session.user.twoFactorEnabled) {
    if (!twoFactorCode) {
      return { status: "error", message: "Enter your two-factor code." };
    }

    if (!(await verifyInlineTwoFactorCode(session.user.id, twoFactorCode))) {
      return { status: "error", message: "That two-factor code didn't work." };
    }
  }

  await recordPendingEmailChange(
    prisma,
    session.user.id,
    session.user.email,
    newEmail,
    VERIFICATION_TOKEN_EXPIRES_IN_HOURS
  );

  try {
    await auth.api.changeEmail({
      body: { newEmail, callbackURL: "/settings/security" },
      headers: requestHeaders,
    });
  } catch (error) {
    await clearPendingEmailChange(prisma, newEmail);

    if (error instanceof APIError) {
      return { status: "error", message: "That didn't work. Try again." };
    }

    throw error;
  }

  return { status: "sent" };
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) {
    return;
  }

  await auth.api
    .revokeSession({ body: { token }, headers: await headers() })
    .catch(() => undefined);

  revalidatePath("/settings/security");
}

export type DisableTwoFactorState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function disableTwoFactorAction(
  _prevState: DisableTwoFactorState,
  formData: FormData
): Promise<DisableTwoFactorState> {
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!password || !code) {
    return {
      status: "error",
      message: "Enter your password and a two-factor code.",
    };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
    };
  }

  if (!(await verifyInlineTwoFactorCode(session.user.id, code))) {
    return { status: "error", message: "That two-factor code didn't work." };
  }

  try {
    // Revoke other sessions *before* disabling: disableTwoFactor reissues
    // the current session's own cookie/token, so calling revokeOtherSessions
    // afterward would try to authenticate with an already-stale cookie.
    await auth.api.revokeOtherSessions({ headers: requestHeaders });
    await auth.api.disableTwoFactor({
      body: { password },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "Incorrect password." };
    }

    throw error;
  }

  await enqueueAndDeliverSecurityNotice(
    prisma,
    mailer,
    {
      recipient: session.user.email,
      type: "two-factor-notice",
      action: "disabled",
    },
    securityAlertService
  );

  revalidatePath("/settings/security");

  return { status: "success" };
}

export type RegenerateBackupCodesState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; backupCodes: string[] };

export async function regenerateBackupCodesAction(
  _prevState: RegenerateBackupCodesState,
  formData: FormData
): Promise<RegenerateBackupCodesState> {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { status: "error", message: "Enter your password." };
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
    };
  }

  try {
    const result = await auth.api.generateBackupCodes({
      body: { password },
      headers: requestHeaders,
    });

    await enqueueAndDeliverSecurityNotice(
      prisma,
      mailer,
      {
        recipient: session.user.email,
        type: "recovery-code-notice",
        action: "regenerated",
      },
      securityAlertService
    );

    return { status: "success", backupCodes: result.backupCodes };
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "Incorrect password." };
    }

    throw error;
  }
}

export type DeleteAccountState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sole-lead-block"; count: number };

// A typed-confirmation safeguard (retyping the account's own email) guards
// against an accidental submit; the authenticated session is the actual
// authorization boundary, the same as the as-yet-unbuilt leave/remove-member
// flows this reuses the sole-Lead block from (#98). Deletion must not rely
// on the cascade that deletes the User's List rows — deleteAccount checks
// and deletes in one locked transaction (List Lead Rules spec, #100).
export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const confirmationEmail = normalizeEmail(formData.get("confirmationEmail"));

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  if (confirmationEmail !== normalizeEmail(session.user.email)) {
    return { status: "error", message: "Type your account email to confirm." };
  }

  const result = await deleteAccount(prisma, { userId: session.user.id });

  if (result.status === "sole-lead-block") {
    return { status: "sole-lead-block", count: result.count };
  }

  await auth.api.signOut({ headers: requestHeaders });
  redirect("/sign-in");
}
