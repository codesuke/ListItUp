"use client";

import { useActionState } from "react";

import { AutoSubmitField } from "./AutoSubmitField";
import { FieldSelect } from "./FieldSelect";
import { CHIP_CONTROL_CLASS } from "./panel-styles";
import type { AddItemAssigneeState } from "./actions";

const initialState: AddItemAssigneeState = { status: "idle" };

// Mirrors MemberRoleSelect's auto-submit-select pattern: useActionState so
// a rejection (#109 — e.g. the target has no access to the Item's List)
// surfaces inline instead of failing silently, the same way an auto-submit
// `<form action={...}>` with no state hook never could.
export function AddAssigneeControl({
  boundAction,
  unassignedMembers,
}: {
  boundAction: (prevState: AddItemAssigneeState, formData: FormData) => Promise<AddItemAssigneeState>;
  unassignedMembers: { userId: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="contents">
      <AutoSubmitField>
        <FieldSelect
          name="userId"
          required
          defaultValue=""
          disabled={isPending}
          aria-label="Add an assignee"
          wrapperClassName="min-w-0"
          controlClassName={CHIP_CONTROL_CLASS}
        >
          <option value="" disabled>
            Add an Assignee…
          </option>
          {unassignedMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </FieldSelect>
      </AutoSubmitField>
      {state.status === "error" ? (
        <span role="alert" className="text-[12px] text-destructive">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
