import assert from "node:assert/strict";

import { canResendVerificationEmail } from "./verification-resend";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/auth-config";

function run() {
  const now = new Date("2026-07-11T12:00:00.000Z");

  assert.equal(
    canResendVerificationEmail(null, now),
    true,
    "must allow resend when no verification email has ever been sent"
  );

  const justUnderCooldown = new Date(
    now.getTime() - (VERIFICATION_RESEND_COOLDOWN_SECONDS - 1) * 1000
  );
  assert.equal(
    canResendVerificationEmail(justUnderCooldown, now),
    false,
    "must block resend before the cooldown elapses"
  );

  const exactlyAtCooldown = new Date(
    now.getTime() - VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000
  );
  assert.equal(
    canResendVerificationEmail(exactlyAtCooldown, now),
    true,
    "must allow resend once the cooldown has fully elapsed"
  );

  const wellPastCooldown = new Date(
    now.getTime() - (VERIFICATION_RESEND_COOLDOWN_SECONDS + 3600) * 1000
  );
  assert.equal(canResendVerificationEmail(wellPastCooldown, now), true);

  console.log("verification resend cooldown test passed");
}

run();
