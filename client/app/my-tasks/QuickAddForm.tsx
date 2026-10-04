"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";

import type { QuickAddItemState } from "./actions";
import type { QuickAddMentionCandidate } from "@/lib/item/item-quick-add";

const MAX_SUGGESTIONS = 6;
const INITIAL_STATE: QuickAddItemState = { status: "idle" };

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

// The `@` trigger is the last `@word` run up to the caret, only when it's
// at the start of the text or preceded by whitespace — matches how
// resolveAssigneeUserIds (lib/item/item-quick-add.ts) tokenizes `@name`
// shorthand at submit time, so what's suggested here is what will actually
// resolve there.
function findMentionTrigger(value: string, caret: number): { start: number; query: string } | null {
  const upToCaret = value.slice(0, caret);
  const match = /(?:^|\s)@(\S*)$/.exec(upToCaret);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  return { start: caret - query.length - 1, query };
}

// A quiet capture row, not a boxed card: the primary action (adding a task)
// is the one place besides the sidebar's active-nav bar that earns brand
// orange (DESIGN.md's Three Uses Rule). A bottom hairline is enough to mark
// where typing happens; it doesn't need a full bordered container to read
// as an input.
export function QuickAddForm({
  quickAddItemAction,
  mentionCandidates,
  selectedWorkspaceId,
}: {
  quickAddItemAction: (prevState: QuickAddItemState, formData: FormData) => Promise<QuickAddItemState>;
  mentionCandidates: QuickAddMentionCandidate[];
  selectedWorkspaceId: string | null;
}) {
  const [state, formAction] = useActionState(quickAddItemAction, INITIAL_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Left uncontrolled on purpose — cleared imperatively below only once an
  // Item was actually created, rather than relying on React's form-reset
  // behavior, which would also wipe out whatever the User typed on a
  // failed submission (lib/item/item-quick-add.ts's "no-inbox-list" /
  // "list-not-found" / "forbidden" results).
  useEffect(() => {
    if (state.status === "created" && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state]);

  const matches = useMemo(() => {
    if (mention === null) {
      return [];
    }
    const query = mention.query.toLowerCase();
    return mentionCandidates
      .filter((candidate) => firstName(candidate.name).toLowerCase().startsWith(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [mention, mentionCandidates]);

  function syncMentionTrigger(target: HTMLInputElement) {
    const trigger = findMentionTrigger(target.value, target.selectionStart ?? target.value.length);
    setMention(trigger);
    setHighlightedIndex(0);
  }

  function selectCandidate(candidate: QuickAddMentionCandidate) {
    const input = inputRef.current;
    if (!input || mention === null) {
      return;
    }
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, mention.start);
    const after = input.value.slice(caret);
    const inserted = `@${firstName(candidate.name)} `;
    input.value = `${before}${inserted}${after}`;
    const newCaret = before.length + inserted.length;
    input.focus();
    input.setSelectionRange(newCaret, newCaret);
    setMention(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (mention === null || matches.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectCandidate(matches[highlightedIndex]);
    } else if (event.key === "Escape") {
      setMention(null);
    }
  }

  return (
    <form action={formAction} onSubmit={() => setMention(null)} className="relative mb-6">
      <div className="flex items-center gap-3 border-b border-line px-1 pb-3 transition-colors focus-within:border-[#ff6b4a]/40">
        <input type="hidden" name="scopedWorkspaceId" value={selectedWorkspaceId ?? ""} />
        <button
          type="submit"
          aria-label="Add task"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#ff8a70] transition-colors hover:text-[#ff6b4a]"
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          name="quickAddText"
          placeholder='Add a task — try "Fix platform signage tomorrow #retrofit @sam ~ClientDeliverables"'
          required
          role="combobox"
          aria-expanded={mention !== null}
          aria-controls="quick-add-mentions"
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(event) => syncMentionTrigger(event.currentTarget)}
          onKeyDown={handleKeyDown}
          onBlur={() => setMention(null)}
          className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-1.5 px-1 text-[12px] text-[#ff8a70]">
          {state.message}
        </p>
      )}
      {mention !== null && (
        <div
          id="quick-add-mentions"
          role="listbox"
          className="absolute left-7 top-full z-10 mt-1 min-w-[180px] rounded-[8px] border border-line bg-surface-2 p-1 shadow-md"
        >
          {matches.length > 0 ? (
            matches.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                // onMouseDown (not onClick) fires before the input's onBlur,
                // so the dropdown's own blur-to-close doesn't eat the click.
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectCandidate(candidate);
                }}
                className={
                  index === highlightedIndex
                    ? "block w-full rounded-[5px] bg-surface-3 px-2.5 py-1.5 text-left text-[13px] text-ink"
                    : "block w-full rounded-[5px] px-2.5 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                }
              >
                {candidate.name}
              </button>
            ))
          ) : (
            <p className="px-2.5 py-1.5 text-[13px] text-ink-faint">
              {mentionCandidates.length === 0 ? "No teammates to mention yet" : "No match"}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
