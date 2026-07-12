import assert from "node:assert/strict";

import { symmetricEncrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";

import {
  verifyAndConsumeBackupCode,
  verifyStoredTotpCode,
} from "./two-factor-verification";

async function run() {
  const key = "test-secret-key-at-least-32-characters-long";
  const rawSecret = "JBSWY3DPEHPK3PXP";
  const encryptedSecret = await symmetricEncrypt({ key, data: rawSecret });

  const validCode = await createOTP(rawSecret, {
    digits: 6,
    period: 30,
  }).totp();

  assert.equal(
    await verifyStoredTotpCode(encryptedSecret, validCode, key),
    true,
    "a code generated from the same secret must verify"
  );
  assert.equal(
    await verifyStoredTotpCode(encryptedSecret, "000000", key),
    false,
    "an arbitrary code must not verify"
  );

  const rawBackupCodes = ["aaaa-1111", "bbbb-2222"];
  const encryptedBackupCodes = await symmetricEncrypt({
    data: JSON.stringify(rawBackupCodes),
    key,
  });

  const firstAttempt = await verifyAndConsumeBackupCode(
    encryptedBackupCodes,
    "aaaa-1111",
    key
  );
  assert.equal(firstAttempt.ok, true);
  assert.ok(firstAttempt.updatedEncryptedBackupCodes);

  const reuseAttempt = await verifyAndConsumeBackupCode(
    firstAttempt.updatedEncryptedBackupCodes!,
    "aaaa-1111",
    key
  );
  assert.equal(
    reuseAttempt.ok,
    false,
    "a consumed backup code must not verify a second time"
  );

  const secondCodeAttempt = await verifyAndConsumeBackupCode(
    firstAttempt.updatedEncryptedBackupCodes!,
    "bbbb-2222",
    key
  );
  assert.equal(
    secondCodeAttempt.ok,
    true,
    "an unused backup code must still verify after a different code was consumed"
  );

  console.log("two-factor verification test passed");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
