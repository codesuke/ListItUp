"use client";

import type { FormEvent } from "react";

// Wraps one field that's associated with a Server Action `<form>` via the
// `form=` attribute rather than DOM nesting (Priority, Due date — see
// DETAILS_FORM_ID in ItemDetailPanel) so it submits itself instead of
// needing a shared visible Save button. `display: contents` keeps the
// wrapper invisible to the Properties row's flex layout — the field
// still participates in the row's gap/alignment exactly as if unwrapped.
export function AutoSubmitField({
  children,
  on = "change",
}: {
  children: React.ReactNode;
  on?: "change" | "blur";
}) {
  function submitOwningForm(event: FormEvent<HTMLElement>) {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    field.form?.requestSubmit();
  }

  const trigger = on === "blur" ? { onBlur: submitOwningForm } : { onChange: submitOwningForm };

  return (
    <span className="contents" {...trigger}>
      {children}
    </span>
  );
}
