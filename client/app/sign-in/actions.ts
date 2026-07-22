"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";

import { auth } from "@/lib/auth/auth";
import { isSafeRelativeCallbackUrl } from "@/lib/session/callback-url";
import { normalizeEmail } from "@/lib/auth/normalize-email";

export type SignInFormState =
  { status: "idle" } | { status: "error"; message: string };

const DEFAULT_CALLBACK_URL = "/my-tasks";
const INVALID_CREDENTIALS_MESSAGE = "Incorrect email or password.";

function readCallbackUrl(formData: FormData): string {
  const value = formData.get("callbackURL");
  return typeof value === "string" && isSafeRelativeCallbackUrl(value)
    ? value
    : DEFAULT_CALLBACK_URL;
}

export async function signInAction(
  _prevState: SignInFormState,
  formData: FormData
): Promise<SignInFormState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const callbackURL = readCallbackUrl(formData);

  if (!email || !password) {
    return { status: "error", message: "Enter your email and password." };
  }

  let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;

  try {
    result = await auth.api.signInEmail({
      body: { email, password, callbackURL },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "EMAIL_NOT_VERIFIED") {
        redirect(`/verify-email?email=${encodeURIComponent(email)}`);
      }

      return { status: "error", message: INVALID_CREDENTIALS_MESSAGE };
    }

    throw error;
  }

  if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
    redirect(`/two-factor?callbackURL=${encodeURIComponent(callbackURL)}`);
  }

  redirect(callbackURL);
}

export type MagicLinkFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

const RETRY_EMAIL_MESSAGE = "We couldn't send that email. Please try again.";

export async function requestMagicLinkAction(
  _prevState: MagicLinkFormState,
  formData: FormData
): Promise<MagicLinkFormState> {
  const email = normalizeEmail(formData.get("email"));
  const callbackURL = readCallbackUrl(formData);

  if (email) {
    try {
      await auth.api.signInMagicLink({
        body: { email, callbackURL },
        headers: await headers(),
      });
    } catch {
      return { status: "error", message: RETRY_EMAIL_MESSAGE };
    }
  }

  return { status: "sent" };
}
