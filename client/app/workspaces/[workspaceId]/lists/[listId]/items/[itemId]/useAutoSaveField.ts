import { useRef, useState, useTransition } from "react";

// Matches the settings page's own save-confirmation timing
// (NotificationPreferencesForm's SAVED_INDICATOR_DURATION_MS) so "Saved"
// reads consistently across the app.
const SAVED_INDICATOR_DURATION_MS = 1800;

// Shared commit/pending/saved logic for every field on this panel that
// submits itself independently (Title, Priority, Due date, Custom Fields)
// instead of through a shared form with its own Save button.
export function useAutoSaveField(fieldName: string, action: (formData: FormData) => Promise<void>) {
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function commit(value: string) {
    const formData = new FormData();
    formData.set(fieldName, value);
    startTransition(async () => {
      await action(formData);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), SAVED_INDICATOR_DURATION_MS);
    });
  }

  return { commit, isPending, justSaved };
}
