"use client";

import { useActionState, useState } from "react";

import { updateMemberRoleAction, type UpdateMemberRoleState } from "./actions";
import type { AssignableWorkspaceRole } from "@/lib/workspace/workspace-member-roles";

const selectClass =
  "shrink-0 border border-line-strong bg-transparent px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted outline-none transition-colors hover:border-[#ff6b4a] focus:border-[#ff6b4a] disabled:cursor-not-allowed disabled:opacity-60";
const initialUpdateMemberRoleState: UpdateMemberRoleState = { status: "idle" };

export function MemberRoleSelect({
  workspaceId,
  userId,
  role,
}: {
  workspaceId: string;
  userId: string;
  role: AssignableWorkspaceRole;
}) {
  const boundAction = updateMemberRoleAction.bind(null, workspaceId, userId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialUpdateMemberRoleState
  );
  // Optimistic pick while the action is in flight — a plain `defaultValue`
  // select gets its uncontrolled value reset by React right after the form
  // action submits (react-dom's post-action requestFormReset), snapping the
  // dropdown back to the pre-submit role before the server even responds.
  // Once the action settles, `role` (refreshed by the action's
  // revalidatePath) is authoritative again, whether it changed or not.
  const [optimisticRole, setOptimisticRole] = useState<AssignableWorkspaceRole | null>(null);
  const selectedRole = isPending ? (optimisticRole ?? role) : role;

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <select
        name="role"
        value={selectedRole}
        disabled={isPending}
        onChange={(event) => {
          setOptimisticRole(event.currentTarget.value as AssignableWorkspaceRole);
          event.currentTarget.form?.requestSubmit();
        }}
        className={selectClass}
      >
        <option value="ADMIN">Admin</option>
        <option value="MEMBER">Member</option>
        <option value="VIEWER">Viewer</option>
      </select>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
