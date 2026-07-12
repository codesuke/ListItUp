"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";

import { auth } from "@/lib/auth/auth";
import { isSafeRelativeCallbackUrl } from "@/lib/session/callback-url";

export type TwoFactorChallengeFormState =
  { status: "idle" } | { status: "error"; message: string };

const DEFAULT_CALLBACK_URL = "/my-tasks";
const INVALID_CODE_MESSAGE = "That code didn't work. Try again.";

function readCallbackUrl(formData: FormData): string {
  const value = formData.get("callbackURL");
  return typeof value === "string" && isSafeRelativeCallbackUrl(value)
    ? value
    : DEFAULT_CALLBACK_URL;
}

export async function verifyTwoFactorChallengeAction(
  _prevState: TwoFactorChallengeFormState,
  formData: FormData
): Promise<TwoFactorChallengeFormState> {
  const code = String(formData.get("code") ?? "").trim();
  const useRecoveryCode = formData.get("mode") === "recovery";
  const callbackURL = readCallbackUrl(formData);

  if (!code) {
    return { status: "error", message: "Enter a code." };
  }

  try {
    if (useRecoveryCode) {
      await auth.api.verifyBackupCode({
        body: { code },
        headers: await headers(),
      });
    } else {
      await auth.api.verifyTOTP({
        body: { code },
        headers: await headers(),
      });
    }
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: INVALID_CODE_MESSAGE };
    }

    throw error;
  }

  redirect(callbackURL);
}
