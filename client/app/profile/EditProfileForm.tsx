"use client";

import { useActionState } from "react";
import { ImageIcon, User as UserIcon } from "lucide-react";

import { updateProfileAction, type UpdateProfileState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const textareaClass =
  "min-h-[120px] w-full flex-1 resize-y bg-transparent px-4 py-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const primaryButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const labelClass =
  "mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted";

const initialUpdateProfileState: UpdateProfileState = { status: "idle" };

export function EditProfileForm({
  name,
  image,
  aboutMe,
}: {
  name: string;
  image: string | null;
  aboutMe: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    initialUpdateProfileState
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="group">
        <label htmlFor="profile-name" className={labelClass}>
          Display Name
        </label>
        <div className={inputWrapperClass}>
          <UserIcon
            className="ml-4 h-5 w-5 text-ink-faint"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="profile-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            defaultValue={name}
            className={inputClass}
          />
        </div>
      </div>

      <div className="group">
        <label htmlFor="profile-image" className={labelClass}>
          Avatar image URL
        </label>
        <div className={inputWrapperClass}>
          <ImageIcon
            className="ml-4 h-5 w-5 text-ink-faint"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="profile-image"
            name="image"
            type="url"
            placeholder="https://..."
            defaultValue={image ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="group">
        <label htmlFor="profile-about-me" className={labelClass}>
          About Me
        </label>
        <div className={inputWrapperClass}>
          <textarea
            id="profile-about-me"
            name="aboutMe"
            maxLength={500}
            placeholder="Tell people a bit about yourself."
            defaultValue={aboutMe ?? ""}
            className={textareaClass}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-[#ff8a70]">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-sm text-ink">
          Profile updated.
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
