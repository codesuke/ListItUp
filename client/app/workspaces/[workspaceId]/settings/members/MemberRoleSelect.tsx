"use client";

import { useActionState } from "react";

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

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <select
        name="role"
        defaultValue={role}
        disabled={isPending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
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
