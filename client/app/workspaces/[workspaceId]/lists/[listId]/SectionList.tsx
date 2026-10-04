"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronRight, Clock, Folder, MoreHorizontal, Plus, Search } from "lucide-react";

import { ADD_BUTTON_PRIMARY } from "@/components/workspace/add-button";
import { AssigneeAvatar } from "@/components/workspace/AssigneeAvatar";

import type { ItemSummary, SectionWithItems } from "./page-data";

// Key used for the unsectioned Items group in the "add item" open/collapsed
// state map below — sections are keyed by their real id, and this group has
// none.
const UNSECTIONED_KEY = "__unsectioned__";

function sectionDomId(key: string): string {
  return `list-section-${key}`;
}

function addItemInputDomId(key: string): string {
  return `list-section-${key}-add-item-input`;
}

// One grid template, shared by every task row and the column header, so a
// field's horizontal position never depends on what any row puts inside it
// — every non-Task track is a hardcoded pixel width (never auto/min-content),
// so a wider word can never shift the columns after it. The whole grid gets
// a min-width and sits in an overflow-x-auto track (see the Sections wrapper
// below) rather than compressing on narrow viewports, the same disclosed
// trade-off Home's My Tasks panel makes at 390px (DESIGN.md).
const ROW_GRID_COLS = "grid-cols-[minmax(0,1fr)_96px_112px_64px_96px_32px]";
const GRID_MIN_WIDTH = "min-w-[600px]";

// Shared horizontal inset for every row so a column's left edge never
// depends on row-specific state — subtask indentation is drawn *inside* the
// Task cell instead (see `ItemRow`).
const ROW_INSET = "px-2.5";

// Width of the indentation spacer drawn inside a subtask's Task cell.
const SUBTASK_INDENT_WIDTH = "w-[28px]";

function SectionIcon({ name }: { name: string }) {
  const normalized = name.trim().toLowerCase();
  const className = "h-4 w-4 flex-shrink-0 text-ink-faint";
  if (/(done|complete|finished|shipped)/.test(normalized)) return <CheckCircle2 className={className} />;
  if (/(progress|doing|active|review)/.test(normalized)) return <Clock className={className} />;
  return <Folder className={className} />;
}

function CompleteToggle({
  checked,
  itemId,
  boundComplete,
}: {
  checked: boolean;
  itemId: string;
  boundComplete: (formData: FormData) => Promise<void>;
}) {
  if (checked) {
    return (
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] bg-[#ff6b4a] animate-in fade-in-0 zoom-in-90 duration-150">
        <Check className="h-[11px] w-[11px] text-[#1a0800] animate-in fade-in-0 zoom-in-50 duration-200" />
      </span>
    );
  }

  return (
    <form action={boundComplete}>
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        aria-label="Mark complete"
        className="h-4 w-4 flex-shrink-0 rounded-[5px] border-[1.5px] border-line-strong transition-colors duration-150 hover:border-[#ff6b4a]"
      />
    </form>
  );
}

// Exactly one label per row: an Item's category Label takes priority over
// its Priority level, and Priority itself only prints for the one level
// that needs flagging (High) — Normal/Low stay silent, the same convention
// My Tasks' row uses for its own priority marker. Plain text, right-
// justified so the right edge stays fixed regardless of word length.
function LabelCell({ item }: { item: ItemSummary }) {
  if (item.labels.length > 0) {
    return (
      <div className="flex w-full justify-end">
        <span className="truncate text-[12.5px] text-ink-muted">{item.labels[0].name}</span>
      </div>
    );
  }

  if (item.priority === "HIGH") {
    return (
      <div className="flex w-full items-center justify-end gap-1.5">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#f2545b]" aria-hidden />
        <span className="text-[12.5px] text-ink-muted">High</span>
      </div>
    );
  }

  return <div className="flex w-full justify-end" />;
}

// Left-aligned: the avatar always starts at this column's fixed left edge,
// independent of every other column's content.
function AssigneeCell({ assignees }: { assignees: ItemSummary["assignees"] }) {
  if (assignees.length === 0) {
    return (
      <div className="flex w-full items-center">
        <span className="text-[13px] text-ink-faint">—</span>
      </div>
    );
  }

  const [assignee] = assignees;
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <AssigneeAvatar name={assignee.name} />
      <span className="min-w-0 truncate text-[13px] text-ink-muted">{assignee.name}</span>
    </div>
  );
}

function DueDateCell({ dueDate }: { dueDate: Date | null }) {
  return (
    <div className="flex w-full justify-end">
      <span className="whitespace-nowrap text-[13px] text-ink-muted">
        {dueDate ? dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
      </span>
    </div>
  );
}

// Plain colored/weighted text, never a pill — DESIGN.md's No-Pill-Status
// Rule. Complete rows stay silent (the checkbox + strikethrough already
// told that story) and so does the default To Do state, the same
// "only the exception needs flagging" convention My Tasks' row status uses.
function itemStatusText(state: ItemSummary["state"]): { text: string; className: string } | null {
  switch (state) {
    case "IN_PROGRESS":
      return { text: "In Progress", className: "text-ink-muted" };
    case "BLOCKED":
      return { text: "Blocked", className: "text-[color:var(--accent-blocked)]" };
    case "ARCHIVED":
      return { text: "Archived", className: "text-ink-muted" };
    default:
      return null;
  }
}

function StatusCell({ state }: { state: ItemSummary["state"] }) {
  const status = itemStatusText(state);
  return (
    <div className="flex w-full justify-end">
      {status && <span className={`whitespace-nowrap text-[12.5px] ${status.className}`}>{status.text}</span>}
    </div>
  );
}

// Row-level actions menu — icon and position only for now; wiring the menu
// itself (rename/duplicate/delete an Item from the row) is a follow-up.
function ItemActionsButton({ itemTitle }: { itemTitle: string }) {
  return (
    <button
      type="button"
      aria-label={`${itemTitle} actions`}
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-ink-faint transition-colors duration-150 hover:bg-surface-4 hover:text-ink"
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  );
}

function ItemRow({
  item,
  workspaceId,
  listId,
  indented,
  boundComplete,
}: {
  item: ItemSummary;
  workspaceId: string;
  listId: string;
  indented: boolean;
  boundComplete: (formData: FormData) => Promise<void>;
}) {
  return (
    <div
      className={`grid ${ROW_GRID_COLS} ${GRID_MIN_WIDTH} items-center gap-4 rounded-[6px] ${ROW_INSET} py-2.5 transition-colors duration-150 hover:bg-surface-3`}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {indented && <span className={`${SUBTASK_INDENT_WIDTH} flex-shrink-0`} aria-hidden="true" />}
        <CompleteToggle checked={item.state === "COMPLETE"} itemId={item.id} boundComplete={boundComplete} />
        <Link
          href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
          className={`min-w-0 truncate text-[13.5px] transition-colors duration-150 hover:underline ${
            item.state === "COMPLETE" ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
          {item.title}
        </Link>
      </div>
      <LabelCell item={item} />
      <AssigneeCell assignees={item.assignees} />
      <DueDateCell dueDate={item.dueDate} />
      <StatusCell state={item.state} />
      <div className="flex justify-end">
        <ItemActionsButton itemTitle={item.title} />
      </div>
    </div>
  );
}

function AddItemForm({
  inputId,
  sectionId,
  boundAddItem,
  autoFocus,
}: {
  inputId: string;
  sectionId: string | null;
  boundAddItem: (formData: FormData) => Promise<void>;
  autoFocus?: boolean;
}) {
  return (
    <form action={boundAddItem} className={`${GRID_MIN_WIDTH} flex items-center gap-2 ${ROW_INSET} py-2`}>
      {sectionId && <input type="hidden" name="sectionId" value={sectionId} />}
      <span className="text-ink-faint">+</span>
      <input
        id={inputId}
        type="text"
        name="title"
        placeholder="Add an Item"
        required
        autoFocus={autoFocus}
        className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <button type="submit" className="text-xs text-ink-faint transition-colors duration-150 hover:text-[#ff8a70]">
        Add
      </button>
    </form>
  );
}

function ColumnHeader() {
  return (
    <div
      className={`hidden sm:grid ${ROW_GRID_COLS} ${GRID_MIN_WIDTH} items-center gap-4 ${ROW_INSET} pb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted`}
    >
      <span>Task</span>
      <span className="text-right">Label</span>
      <span>Assignee</span>
      <span className="text-right">Due</span>
      <span className="text-right">Status</span>
      <span />
    </div>
  );
}

function SectionGroup({
  name,
  count,
  collapsed,
  onToggleCollapse,
  children,
}: {
  name: string;
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 ${ROW_INSET} py-2`}>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
          aria-expanded={!collapsed}
          className="flex-shrink-0 text-ink-faint transition-colors duration-150 hover:text-ink"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`} />
        </button>
        <SectionIcon name={name} />
        <span className="text-[13px] font-semibold text-ink">{name}</span>
        <span className="text-[12px] text-ink-muted">{count}</span>
      </div>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}

export function SectionList({
  sections,
  unsectionedItems,
  canManage,
  workspaceId,
  listId,
  boundAddItem,
  boundCompleteItem,
}: {
  sections: SectionWithItems[];
  unsectionedItems: ItemSummary[];
  canManage: boolean;
  workspaceId: string;
  listId: string;
  boundAddItem: (formData: FormData) => Promise<void>;
  boundCompleteItem: (formData: FormData) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [addOpenIds, setAddOpenIds] = useState<Set<string>>(new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(key: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch = (item: ItemSummary) =>
    normalizedSearch === "" || item.title.toLowerCase().includes(normalizedSearch);

  const searchedSections = sections.map((section) => ({
    ...section,
    items: section.items.filter(matchesSearch),
  }));
  const searchedUnsectionedItems = unsectionedItems.filter(matchesSearch);

  const showUnsectioned = searchedUnsectionedItems.length > 0 || (canManage && normalizedSearch === "");
  const hasRealSections = searchedSections.length > 0;

  const unsectionedItemRows = (
    <>
      {searchedUnsectionedItems.length === 0 ? (
        <div className={`${GRID_MIN_WIDTH} px-3 py-4 text-center text-xs text-ink-muted`}>No Items yet.</div>
      ) : (
        searchedUnsectionedItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            workspaceId={workspaceId}
            listId={listId}
            indented={item.hasParent}
            boundComplete={boundCompleteItem}
          />
        ))
      )}
      {canManage && addOpenIds.has(UNSECTIONED_KEY) && (
        <AddItemForm
          inputId={addItemInputDomId(UNSECTIONED_KEY)}
          sectionId={null}
          boundAddItem={boundAddItem}
          autoFocus
        />
      )}
    </>
  );

  function handleNewTask() {
    const targetKey = searchedSections[0]?.id ?? UNSECTIONED_KEY;
    setCollapsedIds((current) => {
      if (!current.has(targetKey)) return current;
      const next = new Set(current);
      next.delete(targetKey);
      return next;
    });
    setAddOpenIds((current) => new Set(current).add(targetKey));
    requestAnimationFrame(() => {
      document.getElementById(sectionDomId(targetKey))?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Explicit focus (rather than relying on AddItemForm's autoFocus-on-mount)
      // so a second "New Task" click still gives feedback when the form from a
      // previous click is still open — autoFocus only fires once, on mount.
      const input = document.getElementById(addItemInputDomId(targetKey));
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[30px] flex-shrink-0 items-center gap-1.5 rounded-[6px] bg-surface-3 px-2.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Items…"
            className="w-44 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <div className="flex-1" />

        {canManage && (
          <button type="button" onClick={handleNewTask} className={ADD_BUTTON_PRIMARY}>
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        )}
      </div>

      {searchedSections.length === 0 && !showUnsectioned ? (
        <div className="px-4 py-16 text-center text-sm text-ink-muted">
          {normalizedSearch !== "" ? "No Items match your search." : "No Sections yet."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <ColumnHeader />
          <div className="flex flex-col gap-6">
            {searchedSections.map((section) => (
              <div key={section.id} id={sectionDomId(section.id)}>
                <SectionGroup
                  name={section.name}
                  count={section.items.length}
                  collapsed={collapsedIds.has(section.id)}
                  onToggleCollapse={() => toggleCollapsed(section.id)}
                >
                  {section.items.length === 0 ? (
                    <div className={`${GRID_MIN_WIDTH} px-3 py-4 text-center text-xs text-ink-muted`}>No Items yet.</div>
                  ) : (
                    section.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        workspaceId={workspaceId}
                        listId={listId}
                        indented={item.hasParent}
                        boundComplete={boundCompleteItem}
                      />
                    ))
                  )}
                  {canManage && addOpenIds.has(section.id) && (
                    <AddItemForm
                      inputId={addItemInputDomId(section.id)}
                      sectionId={section.id}
                      boundAddItem={boundAddItem}
                      autoFocus
                    />
                  )}
                </SectionGroup>
              </div>
            ))}

            {showUnsectioned && (
              <div id={sectionDomId(UNSECTIONED_KEY)}>
                {hasRealSections ? (
                  <SectionGroup
                    name="No Section"
                    count={searchedUnsectionedItems.length}
                    collapsed={collapsedIds.has(UNSECTIONED_KEY)}
                    onToggleCollapse={() => toggleCollapsed(UNSECTIONED_KEY)}
                  >
                    {unsectionedItemRows}
                  </SectionGroup>
                ) : (
                  // No real Sections exist yet, so every Item is unsectioned —
                  // showing a "No Section" folder with nothing to contrast it
                  // against just reads as leftover chrome. Render the Items
                  // flat instead, same row markup, no header/icon/chevron.
                  <div>{unsectionedItemRows}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
