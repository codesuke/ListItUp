"use server";

import { headers } from "next/headers";

import { canRequestAuthenticationEmail } from "@/lib/auth/auth";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { requestPasswordResetEmail } from "@/lib/auth/password-reset-request";
import { mailer } from "@/lib/mailer/mailer";
import { prisma } from "@/lib/prisma";

export type ForgotPasswordFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

const RETRY_MESSAGE = "We couldn't send that email. Please try again.";

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData
): Promise<ForgotPasswordFormState> {
  const email = normalizeEmail(formData.get("email"));

  if (email) {
    const requestHeaders = await headers();
    const allowed = await canRequestAuthenticationEmail(email, requestHeaders);
    if (!allowed) {
      return { status: "sent" };
    }

    const outcome = await requestPasswordResetEmail(prisma, mailer, email);
    if (outcome === "failed") {
      return { status: "error", message: RETRY_MESSAGE };
    }
  }

  return { status: "sent" };
}
