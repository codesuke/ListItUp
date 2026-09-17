"use client";

import { Search } from "lucide-react";
import { useRef } from "react";

type SearchFormProps = {
  workspace: string;
  completed: string;
  archived: string;
  sort: string;
  group: string;
  search: string;
};

// The search box is native `type="search"`, so browsers render their own
// clear ("x") control. That control only blanks the DOM value — it fires no
// form submission — so without this handler the `q` URL param (the actual
// source of truth every other filter/sort/group/tab link re-forwards) stays
// stale and the "cleared" term silently reapplies on the next navigation.
// Re-submitting whenever the field reaches "" (backspace, cut, or the
// native x) keeps the URL in sync with what's visibly in the box.
export function SearchForm({ workspace, completed, archived, sort, group, search }: SearchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action="/my-tasks" method="GET" className="flex items-center gap-2">
      <input type="hidden" name="workspace" value={workspace} />
      <input type="hidden" name="completed" value={completed} />
      <input type="hidden" name="archived" value={archived} />
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="group" value={group} />
      <div className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-line-strong bg-surface-2 px-2.5">
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
        <input
          key={search}
          type="search"
          name="q"
          defaultValue={search}
          aria-label="Search your Items"
          placeholder="Search…"
          className="w-32 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-faint"
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
