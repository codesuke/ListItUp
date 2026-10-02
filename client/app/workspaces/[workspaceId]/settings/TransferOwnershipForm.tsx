"use client";

import { useActionState } from "react";

import { transferOwnershipAction, type TransferOwnershipState } from "./actions";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const dangerButtonClass =
  "mt-2 inline-flex h-11 min-h-11 items-center justify-center border border-destructive bg-destructive/10 px-6 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialTransferOwnershipState: TransferOwnershipState = { status: "idle" };

export type TransferOwnershipCandidate = {
  userId: string;
  name: string;
  email: string;
};

export function TransferOwnershipForm({
  workspaceId,
  workspaceName,
  candidates,
}: {
  workspaceId: string;
  workspaceName: string;
  candidates: TransferOwnershipCandidate[];
}) {
  const boundAction = transferOwnershipAction.bind(null, workspaceId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialTransferOwnershipState
  );

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        There&apos;s no one else in this Workspace yet to transfer ownership to.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <div className="group">
        <label
          htmlFor="new-owner"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          New Owner
        </label>
        <div className={inputWrapperClass}>
          <select
            id="new-owner"
            name="newOwnerUserId"
            required
            defaultValue=""
            className="h-11 w-full bg-transparent px-4 text-sm text-ink outline-none"
          >
            <option value="" disabled>
              Choose a member
            </option>
            {candidates.map((candidate) => (
              <option key={candidate.userId} value={candidate.userId}>
                {candidate.name} ({candidate.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="group">
        <label
          htmlFor="confirm-workspace-name"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          Type &ldquo;{workspaceName}&rdquo; to confirm
        </label>
        <div className={inputWrapperClass}>
          <input
            id="confirm-workspace-name"
            name="confirmedWorkspaceName"
            type="text"
            autoComplete="off"
            required
            className={inputClass}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-sm text-ink animate-in fade-in-0 slide-in-from-top-1 duration-200">
          Ownership transferred. You&apos;re now an Admin on this Workspace.
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={dangerButtonClass}>
        {isPending ? "Transferring..." : "Transfer ownership"}
      </button>
    </form>
  );
}
