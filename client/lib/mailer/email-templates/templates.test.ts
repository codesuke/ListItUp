import assert from "node:assert/strict";

import { verificationEmail } from "./verification";
import { magicLinkEmail } from "./magic-link";
import { passwordResetEmail } from "./password-reset";
import { emailChangeEmail } from "./email-change";
import { emailChangedNoticeEmail } from "./email-changed-notice";
import { twoFactorNoticeEmail } from "./two-factor-notice";
import { failedSignInNoticeEmail } from "./failed-sign-in-notice";
import { recoveryCodeNoticeEmail } from "./recovery-code-notice";
import { workspaceInvitationEmail } from "./workspace-invitation";
import type { EmailTemplate } from "./render";

function assertWellFormed(template: EmailTemplate, label: string) {
  assert.ok(template.subject.length > 0, `${label}: subject must not be empty`);
  assert.ok(
    template.previewText.length > 0,
    `${label}: previewText must not be empty`
  );
  assert.ok(
    template.html.startsWith("<!doctype html>"),
    `${label}: html must use the shared layout`
  );
  assert.ok(
    template.text.length > 0,
    `${label}: text fallback must not be empty`
  );
}

function run() {
  const verification = verificationEmail({
    verifyUrl: "https://listitup.test/verify-email?token=v1",
    expiresInHours: 24,
  });
  assertWellFormed(verification, "verification");
  assert.equal(verification.subject, "Confirm your email address");
  assert.ok(
    verification.html.includes(
      'href="https://listitup.test/verify-email?token=v1"'
    )
  );
  assert.ok(verification.text.includes("24 hours"));

  const magicLink = magicLinkEmail({
    magicLinkUrl: "https://listitup.test/magic?token=m1",
    expiresInMinutes: 15,
  });
  assertWellFormed(magicLink, "magic-link");
  assert.equal(magicLink.subject, "Your ListItUp sign-in link");
  assert.ok(
    magicLink.html.includes('href="https://listitup.test/magic?token=m1"')
  );
  assert.ok(magicLink.text.includes("15 minutes"));

  const passwordReset = passwordResetEmail({
    resetUrl: "https://listitup.test/reset-password?token=p1",
    expiresInMinutes: 15,
  });
  assertWellFormed(passwordReset, "password-reset");
  assert.equal(passwordReset.subject, "Reset your password");
  assert.ok(
    passwordReset.html.includes(
      'href="https://listitup.test/reset-password?token=p1"'
    )
  );
  assert.ok(passwordReset.text.includes("15 minutes"));

  const emailChange = emailChangeEmail({
    confirmUrl: "https://listitup.test/confirm-email?token=e1",
    newEmail: "new@listitup.test",
    expiresInHours: 24,
  });
  assertWellFormed(emailChange, "email-change");
  assert.equal(emailChange.subject, "Confirm your new email address");
  assert.ok(emailChange.html.includes("new@listitup.test"));
  assert.ok(
    emailChange.html.includes(
      'href="https://listitup.test/confirm-email?token=e1"'
    )
  );

  const emailChangedNotice = emailChangedNoticeEmail({
    newEmail: "new@listitup.test",
  });
  assertWellFormed(emailChangedNotice, "email-changed-notice");
  assert.equal(emailChangedNotice.subject, "Your email address was changed");
  assert.ok(emailChangedNotice.html.includes("new@listitup.test"));

  const twoFactorEnabled = twoFactorNoticeEmail({ action: "enabled" });
  assertWellFormed(twoFactorEnabled, "two-factor-notice (enabled)");
  assert.equal(
    twoFactorEnabled.subject,
    "Two-factor authentication was enabled"
  );

  const twoFactorDisabled = twoFactorNoticeEmail({ action: "disabled" });
  assertWellFormed(twoFactorDisabled, "two-factor-notice (disabled)");
  assert.equal(
    twoFactorDisabled.subject,
    "Two-factor authentication was disabled"
  );

  const failedSignIn = failedSignInNoticeEmail();
  assertWellFormed(failedSignIn, "failed sign-in notice");
  assert.equal(failedSignIn.subject, "We noticed repeated sign-in attempts");

  const recoveryRegenerated = recoveryCodeNoticeEmail({
    reason: "regenerated",
  });
  assertWellFormed(recoveryRegenerated, "recovery-code-notice (regenerated)");
  assert.equal(
    recoveryRegenerated.subject,
    "Your recovery codes were regenerated"
  );

  const recoveryInvalidated = recoveryCodeNoticeEmail({
    reason: "invalidated",
  });
  assertWellFormed(recoveryInvalidated, "recovery-code-notice (invalidated)");
  assert.equal(
    recoveryInvalidated.subject,
    "Your recovery codes were invalidated"
  );

  const invitation = workspaceInvitationEmail({
    inviterName: "Priya",
    workspaceName: "Launch Team",
    inviteUrl: "https://listitup.test/invite?token=i1",
    expiresInDays: 7,
  });
  assertWellFormed(invitation, "workspace-invitation");
  assert.equal(
    invitation.subject,
    "Priya invited you to Launch Team on ListItUp"
  );
  assert.ok(
    invitation.html.includes('href="https://listitup.test/invite?token=i1"')
  );
  assert.ok(invitation.text.includes("7 days"));

  console.log("email templates test passed");
}

run();
