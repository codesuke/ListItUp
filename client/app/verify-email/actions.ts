"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { isSafeRelativeCallbackUrl } from "@/lib/session/callback-url";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { prisma } from "@/lib/prisma";
import { resendVerificationEmailIfAllowed } from "@/lib/auth/verification-resend";

export type ResendFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

const DEFAULT_RETURN_TO = "/my-tasks";
const RETRY_MESSAGE = "We couldn't send that email. Please try again.";

function readReturnTo(formData: FormData): string {
  const value = formData.get("returnTo");
  return typeof value === "string" && isSafeRelativeCallbackUrl(value)
    ? value
    : DEFAULT_RETURN_TO;
}

export async function resendVerificationAction(
  _prevState: ResendFormState,
  formData: FormData
): Promise<ResendFormState> {
  const email = normalizeEmail(formData.get("email"));
  const returnTo = readReturnTo(formData);

  if (email) {
    try {
      await resendVerificationEmailIfAllowed(
        prisma,
        async (targetEmail) => {
          await auth.api.sendVerificationEmail({
            body: { email: targetEmail, callbackURL: returnTo },
            headers: await headers(),
          });
        },
        email
      );
    } catch {
      return { status: "error", message: RETRY_MESSAGE };
    }
  }

  return { status: "sent" };
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
