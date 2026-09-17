"use client";

import { useState } from "react";

// Dropping a card onto the Blocked column (STATE grouping) needs a reason
// the same way the Move-to select's blocker-reason field does — this
// collects it after a drag-drop instead of failing the move silently.
export function BlockerReasonDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-lg border border-line-strong bg-surface-2 p-4 shadow-2xl">
        <p className="text-sm font-semibold text-ink">Why is this Blocked?</p>
        <input
          autoFocus
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Blocker reason (required)"
          className="mt-3 w-full rounded-md border border-line-strong bg-surface-1 px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line-strong px-3 py-1.5 text-xs text-ink-muted hover:border-line-strong hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md border border-[#ff6b4a] px-3 py-1.5 text-xs text-[#ff8a70] hover:bg-[#ff6b4a] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Move to Blocked
          </button>
        </div>
      </div>
    </div>
  );
}
