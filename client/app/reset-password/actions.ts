"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth";

import { auth } from "@/lib/auth/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/auth-config";

export type ResetPasswordFormState =
  { status: "idle" } | { status: "error"; message: string };

const INVALID_TOKEN_MESSAGE =
  "This reset link is invalid or has expired. Request a new one.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  PASSWORD_TOO_LONG: "Password is too long.",
  INVALID_TOKEN: INVALID_TOKEN_MESSAGE,
};

export async function resetPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("password") ?? "");

  if (!token) {
    return { status: "error", message: INVALID_TOKEN_MESSAGE };
  }

  if (!newPassword) {
    return { status: "error", message: "Enter a new password." };
  }

  try {
    await auth.api.resetPassword({ body: { newPassword, token } });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message:
          FRIENDLY_ERROR_MESSAGES[error.body?.code ?? ""] ??
          GENERIC_ERROR_MESSAGE,
      };
    }

    throw error;
  }

  redirect("/sign-in");
}
