"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";

import { auth } from "@/lib/auth/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/auth-config";
import { isSafeRelativeCallbackUrl } from "@/lib/session/callback-url";
import { normalizeEmail } from "@/lib/auth/normalize-email";

export type SignUpFormState =
  { status: "idle" } | { status: "error"; message: string };

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  PASSWORD_TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  PASSWORD_TOO_LONG: "Password is too long.",
};

const GENERIC_SIGN_UP_ERROR = "Something went wrong. Please try again.";
const DEFAULT_CALLBACK_URL = "/my-tasks";

function readCallbackUrl(formData: FormData): string {
  const value = formData.get("callbackURL");
  return typeof value === "string" && isSafeRelativeCallbackUrl(value)
    ? value
    : DEFAULT_CALLBACK_URL;
}

export async function signUpAction(
  _prevState: SignUpFormState,
  formData: FormData
): Promise<SignUpFormState> {
  const name = String(formData.get("displayName") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const callbackURL = readCallbackUrl(formData);

  if (!name || !email || !password) {
    return {
      status: "error",
      message: "Enter your name, email, and password.",
    };
  }

  try {
    await auth.api.signUpEmail({
      body: { name, email, password, callbackURL },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message:
          FRIENDLY_ERROR_MESSAGES[error.body?.code ?? ""] ??
          GENERIC_SIGN_UP_ERROR,
      };
    }

    throw error;
  }

  redirect(
    `/verify-email?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(callbackURL)}`
  );
}
