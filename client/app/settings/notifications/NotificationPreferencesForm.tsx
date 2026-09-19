"use client";

import { Check } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type { PreferenceCategory } from "@/lib/notification/notification-preferences";

import {
  updateNotificationPreferencesAction,
  type UpdateNotificationPreferencesState,
} from "./actions";

const SAVED_INDICATOR_DURATION_MS = 1800;

const CATEGORY_LABEL: Record<PreferenceCategory, string> = {
  assignee: "Assignee change",
  noteOrMention: "Note / Mention",
  state: "Item state change",
  dueDateReminder: "Due-date reminder",
};

const CATEGORY_DESCRIPTION: Record<PreferenceCategory, string> = {
  assignee: "When you're assigned to or removed from an Item.",
  noteOrMention:
    "When a Note is added to one of your Items, or you're @mentioned.",
  state: "When an Item you're assigned to changes state.",
  dueDateReminder: "As the due date on an Item you're assigned to approaches.",
};

const CATEGORIES = Object.keys(CATEGORY_LABEL) as PreferenceCategory[];

const initialState: UpdateNotificationPreferencesState = { status: "idle" };

export function NotificationPreferencesForm({
  enabledByCategory,
}: {
  enabledByCategory: Record<PreferenceCategory, boolean>;
}) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationPreferencesAction,
    initialState
  );
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state.status === "success") {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), SAVED_INDICATOR_DURATION_MS);
      wasPending.current = isPending;
      return () => clearTimeout(timeout);
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <form action={formAction}>
      <div className="flex flex-col gap-3">
        {CATEGORIES.map((category) => (
          <label
            key={category}
            className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-2 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          >
            <span>
              <span className="block text-[13.5px] font-semibold text-ink">
                {CATEGORY_LABEL[category]}
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-muted">
                {CATEGORY_DESCRIPTION[category]}
              </span>
            </span>
            <span className="relative inline-flex h-[19px] w-[34px] shrink-0 items-center rounded-full border border-line-strong bg-surface-4 transition-colors has-[:checked]:border-[#ff6b4a] has-[:checked]:bg-[#ff6b4a24]">
              <input
                type="checkbox"
                name={category}
                defaultChecked={enabledByCategory[category]}
                className="peer sr-only"
              />
              <span className="absolute left-[2px] h-[13px] w-[13px] rounded-full bg-ink-muted transition-all peer-checked:left-[17px] peer-checked:bg-[#ff6b4a]" />
            </span>
          </label>
        ))}
      </div>

      {state.status === "success" ? (
        <p role="status" className="mt-3 text-[12.5px] text-ink-muted animate-in fade-in-0 slide-in-from-top-1 duration-200">
          Notification preferences updated.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-transparent bg-[#ff6b4a] px-3 py-[7px] text-[13px] font-semibold text-[#1a0800] transition-colors hover:bg-[#ff8a70] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" />
        <span key={isPending ? "saving" : justSaved ? "saved" : "idle"} className="animate-in fade-in-0 duration-150">
          {isPending ? "Saving..." : justSaved ? "Saved" : "Save changes"}
        </span>
      </button>
    </form>
  );
}
