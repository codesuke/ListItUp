"use client";

import { useActionState } from "react";

import { ADD_BUTTON_SECONDARY } from "@/components/workspace/add-button";
import type { EligibleWorkspaceMember } from "./page-data";
import type { ListRoleActionResult } from "./actions";

const INITIAL_STATE: ListRoleActionResult = { status: "ok" };

// The Manage Access panel's "Add member" selector (#28, #96) — a Workspace
// Viewer offered MEMBER here is rejected at write time, so the result needs
// surfacing instead of the plain void form action used before.
export function AddListMemberForm({
  eligibleMembers,
  boundAddMember,
}: {
  eligibleMembers: EligibleWorkspaceMember[];
  boundAddMember: (prevState: ListRoleActionResult, formData: FormData) => Promise<ListRoleActionResult>;
}) {
  const [state, formAction] = useActionState(boundAddMember, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          name="userId"
          required
          defaultValue=""
          className="h-9 w-44 truncate rounded-[6px] border border-line-strong bg-surface-2 px-3 text-sm text-ink"
        >
          <option value="" disabled>
            Add member
          </option>
          {eligibleMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue="MEMBER"
          className="h-9 w-28 rounded-[6px] border border-line-strong bg-surface-2 px-3 text-sm text-ink"
        >
          <option value="MEMBER">Member</option>
          <option value="VIEWER">Viewer</option>
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
