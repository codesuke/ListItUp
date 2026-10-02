"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, ListTree, Search, User } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { GlobalSearchResult } from "@/lib/search/global-search";

// Debounce window for live-as-you-type queries against /api/search
// (settled in docs/QnA/global-search-command-palette.md, #5).
const QUERY_DEBOUNCE_MS = 200;

const EMPTY_RESULT: GlobalSearchResult = { lists: [], items: [], members: [] };

function itemHref(workspaceId: string, listId: string, itemId: string): string {
  return `/workspaces/${workspaceId}/lists/${listId}/items/${itemId}`;
}

// The header's Cmd/Ctrl+K command palette (#56, #70, ADR 0015): opened by
// GlobalHeaderActions' Search button or the global keyboard shortcut,
// queries /api/search live as the User types, and navigates to the
// selected List/Item/Member result.
export function SearchPalette({
  workspaceId,
  triggerClassName,
}: {
  workspaceId: string;
  triggerClassName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>(EMPTY_RESULT);
  const trimmedQuery = query.trim();
  // Derived, not stored: avoids needing an effect to reset `results` to
  // empty on blank queries (docs/agents/nextjs-conventions.md's "derive
  // during render instead of mirroring into state").
  const displayResults = trimmedQuery ? results : EMPTY_RESULT;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !trimmedQuery) {
      return;
    }

    const abortController = new AbortController();
    const debounceTimer = setTimeout(() => {
      const params = new URLSearchParams({ workspaceId, q: trimmedQuery });
      fetch(`/api/search?${params.toString()}`, { signal: abortController.signal })
        .then((response) => (response.ok ? (response.json() as Promise<GlobalSearchResult>) : EMPTY_RESULT))
        .then(setResults)
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setResults(EMPTY_RESULT);
          }
        });
    }, QUERY_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [trimmedQuery, open, workspaceId]);

  function selectResult(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasNoResults =
    trimmedQuery.length > 0 &&
    displayResults.lists.length === 0 &&
    displayResults.items.length === 0 &&
    displayResults.members.length === 0;

  return (
    <>
      <button type="button" aria-label="Search" title="Search" onClick={() => setOpen(true)} className={triggerClassName}>
        <Search className="h-[15px] w-[15px]" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search Lists, Items, and Members in this Workspace"
      >
        {/* shouldFilter=false: /api/search already filters/orders server-side
            (settled design, #3/#9) — cmdk's own fuzzy filter would otherwise
            re-filter and reorder already-correct results client-side. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search Lists, Items, Members…" value={query} onValueChange={setQuery} />
          <CommandList>
            {hasNoResults && <CommandEmpty>No results found.</CommandEmpty>}

            {displayResults.lists.length > 0 && (
              <CommandGroup heading="Lists">
                {displayResults.lists.map((list) => (
                  <CommandItem
                    key={list.id}
                    value={`list-${list.id}-${list.name}`}
                    onSelect={() => selectResult(`/workspaces/${workspaceId}/lists/${list.id}`)}
                  >
                    <ListTree />
                    {list.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {displayResults.items.length > 0 && (
              <CommandGroup heading="Items">
                {displayResults.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`item-${item.id}-${item.title}`}
                    onSelect={() => selectResult(itemHref(workspaceId, item.listId, item.id))}
                  >
                    <ListTodo />
                    {item.title}
                    <span className="ml-auto text-xs text-muted-foreground">{item.listName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {displayResults.members.length > 0 && (
              <CommandGroup heading="Members">
                {displayResults.members.map((member) => (
                  <CommandItem
                    key={member.userId}
                    value={`member-${member.userId}-${member.name}`}
                    onSelect={() => selectResult(`/users/${member.userId}`)}
                  >
                    <User />
                    {member.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
