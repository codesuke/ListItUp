"use client";

import { useActionState } from "react";

import { ADD_BUTTON_SECONDARY } from "@/components/workspace/add-button";
import type { ListRoleActionResult } from "./actions";

const INITIAL_STATE: ListRoleActionResult = { status: "ok" };

// The Manage Access panel's "Add by email" field (#28, #96) — a Workspace
// Viewer offered MEMBER here is rejected at write time, so the result needs
// surfacing instead of the plain void form action used before.
export function AddListAccessByEmailForm({
  boundAddByEmail,
}: {
  boundAddByEmail: (prevState: ListRoleActionResult, formData: FormData) => Promise<ListRoleActionResult>;
}) {
  const [state, formAction] = useActionState(boundAddByEmail, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="Add by email"
          className="h-9 w-56 rounded-[6px] border border-line-strong bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b4a]"
        />
        <select
          name="role"
          defaultValue="GUEST"
          className="h-9 w-28 rounded-[6px] border border-line-strong bg-surface-2 px-3 text-sm text-ink"
        >
          <option value="MEMBER">Member</option>
          <option value="VIEWER">Viewer</option>
          <option value="GUEST">Guest</option>
        </select>
        <button type="submit" className={`h-9 shrink-0 ${ADD_BUTTON_SECONDARY}`}>
          Add
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
