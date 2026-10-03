"use client";

import { Search } from "lucide-react";
import { useRef } from "react";

type ListSearchFormProps = {
  action: string;
  tab: string;
  status: string;
  member: string;
  starred: string;
  search: string;
};

// Mirrors my-tasks/SearchForm's native-clear handling: a `type="search"`
// field's browser-drawn "x" only blanks the DOM value and fires no
// submission, so without this the `search` URL param (the source every
// other filter/tab link re-forwards) goes stale once the box reads empty.
export function ListSearchForm({ action, tab, status, member, starred, search }: ListSearchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} method="GET" className="flex items-center gap-2">
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="member" value={member} />
      {starred && <input type="hidden" name="starred" value={starred} />}
      <div className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-surface-3 px-2.5 transition-colors focus-within:bg-surface-2 focus-within:ring-1 focus-within:ring-line-strong">
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" />
        <input
          key={search}
          type="search"
          name="search"
          defaultValue={search}
          aria-label="Search Lists by name"
          placeholder="Search Lists…"
          className="w-40 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
          onChange={(event) => {
            if (event.currentTarget.value === "") {
              formRef.current?.requestSubmit();
            }
          }}
        />
      </div>
    </form>
  );
}
