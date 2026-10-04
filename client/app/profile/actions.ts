"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export type UpdateProfileState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const ABOUT_ME_MAX_LENGTH = 500;

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateProfileAction(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const name = String(formData.get("name") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim();
  const aboutMe = String(formData.get("aboutMe") ?? "").trim();

  if (!name) {
    return { status: "error", message: "Enter a display name." };
  }

  if (image && !isValidImageUrl(image)) {
    return { status: "error", message: "Enter a valid image URL." };
  }

  if (aboutMe.length > ABOUT_ME_MAX_LENGTH) {
    return {
      status: "error",
      message: `About Me must be ${ABOUT_ME_MAX_LENGTH} characters or fewer.`,
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
    };
  }

  // A User can only ever edit their own Profile (CONTEXT.md) — the row to
  // update is scoped to the session's own user id, never a value read from
  // the form.
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      image: image || null,
      aboutMe: aboutMe || null,
    },
  });

  revalidatePath("/profile");

  return { status: "success" };
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
