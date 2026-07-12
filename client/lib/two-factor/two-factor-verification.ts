import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";

import {
  TWO_FACTOR_TOTP_DIGITS,
  TWO_FACTOR_TOTP_PERIOD_SECONDS,
} from "@/lib/auth/auth-config";

export async function verifyStoredTotpCode(
  encryptedSecret: string,
  code: string,
  secretKey: string
): Promise<boolean> {
  const secret = await symmetricDecrypt({
    key: secretKey,
    data: encryptedSecret,
  });

  return createOTP(secret, {
    digits: TWO_FACTOR_TOTP_DIGITS,
    period: TWO_FACTOR_TOTP_PERIOD_SECONDS,
  }).verify(code);
}

// Better Auth's own backup-code encode/verify functions are declared in its
// public .d.mts but are not actually exported by the compiled package, and
// there is no exported subpath for the submodule that defines them (its
// package.json "exports" map only lists "./plugins/two-factor"). This
// reimplements the exact same "encrypted" storage format it uses internally
// — JSON.stringify(codes) run through symmetricEncrypt/Decrypt with the app
// secret — matching the backupCodeOptions.storeBackupCodes: "encrypted"
// configured in auth-core.ts, so it stays compatible with codes Better
// Auth's own enableTwoFactor/generateBackupCodes endpoints write.
function parseDecryptedBackupCodes(json: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(json);

    return Array.isArray(parsed) &&
      parsed.every((code) => typeof code === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export interface BackupCodeVerification {
  ok: boolean;
  updatedEncryptedBackupCodes: string | null;
}

export async function verifyAndConsumeBackupCode(
  encryptedBackupCodes: string,
  code: string,
  secretKey: string
): Promise<BackupCodeVerification> {
  const decrypted = await symmetricDecrypt({
    key: secretKey,
    data: encryptedBackupCodes,
  });
  const codes = parseDecryptedBackupCodes(decrypted);

  if (!codes) {
    return { ok: false, updatedEncryptedBackupCodes: null };
  }

  const ok = codes.includes(code);
  const remaining = codes.filter((storedCode) => storedCode !== code);
  const updatedEncryptedBackupCodes = await symmetricEncrypt({
    data: JSON.stringify(remaining),
    key: secretKey,
  });

  return { ok, updatedEncryptedBackupCodes };
}
