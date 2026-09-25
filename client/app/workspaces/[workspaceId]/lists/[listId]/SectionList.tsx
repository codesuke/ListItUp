"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
} from "lucide-react";

import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { RevealAddControl } from "@/components/workspace/RevealAddControl";
import { StatusBadge, type StatusBadgeTone } from "@/components/workspace/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ItemSummary, SectionWithItems } from "./page-data";

// Key used for the unsectioned Items group in the per-section "add item"
// open/collapsed state maps below — sections are keyed by their real id, and
// this group has none.
const UNSECTIONED_KEY = "__unsectioned__";

function sectionDomId(key: string): string {
  return `list-section-${key}`;
}

const STATE_DOT_COLOR: Record<ItemSummary["state"], string> = {
  TO_DO: "#5a5a56",
  IN_PROGRESS: "#5b9dff",
  BLOCKED: "#f5b642",
  COMPLETE: "#3ecf8e",
  ARCHIVED: "#525252",
};

const PRIORITY_LABEL: Record<ItemSummary["priority"], string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
};

const PRIORITY_COLOR: Record<ItemSummary["priority"], string> = {
  LOW: "text-ink-faint",
  NORMAL: "text-ink-muted",
  HIGH: "text-[#ff8a70]",
};

// Status column always shows one of these, distinct from the Due date
// column — never merged into a single pill the way the old badge was.
const STATUS_BADGE: Record<ItemSummary["state"], { tone: StatusBadgeTone; label: string }> = {
  TO_DO: { tone: "muted", label: "Open" },
  IN_PROGRESS: { tone: "blue", label: "In Progress" },
  BLOCKED: { tone: "amber", label: "Blocked" },
  COMPLETE: { tone: "green", label: "Complete" },
  ARCHIVED: { tone: "muted", label: "Archived" },
};

// One grid template, shared by every Section's header row and every task
// row (active and the "No Section" group), so Priority/Assignee/Due
// date/Status land in the same physical columns everywhere — a real CSS
// grid track's width never depends on what any row puts inside it, unlike
// flex-basis, which is what let a heavily-labeled Item drift out of
// alignment before.
const ROW_GRID_COLS = "grid-cols-[minmax(0,1fr)_4rem_13rem_4rem_6rem]";

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

function FacetIcon({ icon: Icon, count }: { icon: React.ComponentType<{ className?: string }>; count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-[3px] font-[family-name:var(--font-mono-label)] text-[11px] text-ink-faint">
      <Icon className="h-3 w-3" /> {count}
    </span>
  );
}

function PriorityCell({ priority }: { priority: ItemSummary["priority"] }) {
  return (
    <span
      className={`text-right font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.04em] ${PRIORITY_COLOR[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

// Labels and the dependency/note/attachment counts integrate into the
// Assignee column instead of getting a column of their own between the task
// title and Priority — they share this cell's fixed grid track, so they
// never affect where Priority/Due date/Status land.
function AssigneeCell({
  assignees,
  labels,
  dependencyCount,
  noteCount,
  attachmentCount,
}: {
  assignees: ItemSummary["assignees"];
  labels: ItemSummary["labels"];
  dependencyCount: number;
  noteCount: number;
  attachmentCount: number;
}) {
  const hasExtras = labels.length > 0 || dependencyCount > 0 || noteCount > 0 || attachmentCount > 0;

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-left">
      {assignees.length === 0 ? (
        <span className="text-[13px] text-ink-faint">—</span>
      ) : (
        <>
          <span className="flex flex-shrink-0 -space-x-1.5">
            {assignees.slice(0, 3).map((assignee) => (
              <MemberAvatar key={assignee.userId} name={assignee.name} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
            {assignees[0].name}
            {assignees.length > 1 ? ` +${assignees.length - 1}` : ""}
          </span>
        </>
      )}
      {hasExtras && (
        <span className="flex w-14 flex-shrink-0 items-center justify-end gap-1 overflow-hidden">
          {labels.slice(0, 1).map((label) => (
            <span
              key={label.id}
              className="max-w-[40px] truncate whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-1.5 py-0.5 font-[family-name:var(--font-mono-label)] text-[10px] text-ink-muted"
            >
              {label.name}
            </span>
          ))}
          <FacetIcon icon={Link2} count={dependencyCount} />
          <FacetIcon icon={MessageSquare} count={noteCount} />
          <FacetIcon icon={Paperclip} count={attachmentCount} />
        </span>
      )}
    </div>
  );
}

function DueDateCell({ dueDate }: { dueDate: Date | null }) {
  return (
    <span className="text-right font-[family-name:var(--font-mono-label)] text-[11px] text-ink-muted">
      {dueDate ? dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
    </span>
  );
}

function StatusCell({ state }: { state: ItemSummary["state"] }) {
  const { tone, label } = STATUS_BADGE[state];
  return (
    <span className="flex justify-end">
      <StatusBadge tone={tone}>{label}</StatusBadge>
    </span>
  );
}

function ColumnHeaders() {
  const headerClass =
    "font-[family-name:var(--font-mono-label)] text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint";
  return (
    <div className={`grid ${ROW_GRID_COLS} items-center gap-2.5 px-2.5 pb-1 pt-0.5`}>
      <span />
      <span className={`${headerClass} text-right`}>Priority</span>
      <span className={`${headerClass} text-left`}>Assignee</span>
      <span className={`${headerClass} text-right`}>Due date</span>
      <span className={`${headerClass} text-right`}>Status</span>
    </div>
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
      className={`grid ${ROW_GRID_COLS} items-center gap-2.5 rounded-[8px] py-2 pr-2.5 transition-colors duration-150 hover:bg-surface-3 ${
        indented ? "pl-[52px]" : "pl-2.5"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <CompleteToggle checked={item.state === "COMPLETE"} itemId={item.id} boundComplete={boundComplete} />
        {!indented && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: STATE_DOT_COLOR[item.state] }} />}
        <Link
          href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
          className={`min-w-0 flex-1 truncate text-[13.5px] transition-colors duration-150 hover:underline ${
            item.state === "COMPLETE" ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
          {item.title}
        </Link>
      </div>
      <PriorityCell priority={item.priority} />
      <AssigneeCell
        assignees={item.assignees}
        labels={item.labels}
        dependencyCount={item.dependencyCount}
        noteCount={item.noteCount}
        attachmentCount={item.attachmentCount}
      />
      <DueDateCell dueDate={item.dueDate} />
      <StatusCell state={item.state} />
    </div>
  );
}

function ArchivedItemRow({
  item,
  workspaceId,
  listId,
  boundRestore,
}: {
  item: ItemSummary;
  workspaceId: string;
  listId: string;
  boundRestore: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] px-2.5 py-2">
      <Link
        href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
        className="min-w-0 flex-1 truncate text-[13.5px] text-ink-muted transition-colors duration-150 hover:text-ink hover:underline"
      >
        {item.title}
      </Link>
      <form action={boundRestore}>
        <input type="hidden" name="itemId" value={item.id} />
        <button
          type="submit"
          className="rounded-[6px] border border-line-strong px-3 py-1 text-xs text-ink-muted transition-colors duration-150 hover:border-[#ff6b4a] hover:text-ink"
        >
          Restore
        </button>
      </form>
    </div>
  );
}

function AddItemForm({
  sectionId,
  boundAddItem,
  autoFocus,
}: {
  sectionId: string | null;
  boundAddItem: (formData: FormData) => Promise<void>;
  autoFocus?: boolean;
}) {
  return (
    <form action={boundAddItem} className="flex items-center gap-2 px-2.5 py-2">
      {sectionId && <input type="hidden" name="sectionId" value={sectionId} />}
      <span className="text-ink-faint">+</span>
      <input
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

function SectionAddButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex flex-shrink-0 items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] font-medium text-[#ff8a70] transition-colors duration-150 hover:bg-surface-4 hover:text-[#ff6b4a]"
    >
      <Plus className="h-3.5 w-3.5" /> Add
    </button>
  );
}

function callSectionAction(action: (formData: FormData) => Promise<void>, fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return action(formData);
}

// Section management (rename/duplicate/reorder/delete) lives behind the
// Section's own name instead of a separate icon — clicking the name it's
// already showing opens the same actions without adding a new visible
// control to the header.
function SectionNameMenu({
  name,
  sectionId,
  onRename,
  boundDuplicateSection,
  boundMoveSection,
  boundDeleteSection,
}: {
  name: string;
  sectionId: string;
  onRename: () => void;
  boundDuplicateSection: (formData: FormData) => Promise<void>;
  boundMoveSection: (formData: FormData) => Promise<void>;
  boundDeleteSection: (formData: FormData) => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${name} Section actions`}
        title="Section actions"
        className="rounded-[4px] bg-transparent p-0 text-[13px] font-semibold text-ink outline-none transition-colors duration-150 hover:text-ink-muted"
      >
        {name}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void callSectionAction(boundDuplicateSection, { sectionId })}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void callSectionAction(boundMoveSection, { sectionId, direction: "up" })}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void callSectionAction(boundMoveSection, { sectionId, direction: "down" })}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void callSectionAction(boundDeleteSection, { sectionId })}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SectionList({
  sections,
  unsectionedItems,
  archivedItems,
  canManage,
  groupBy,
  workspaceId,
  listId,
  boundAddSection,
  boundRenameSection,
  boundDuplicateSection,
  boundDeleteSection,
  boundMoveSection,
  boundSetGroupBy,
  boundAddItem,
  boundRestoreItem,
  boundCompleteItem,
}: {
  sections: SectionWithItems[];
  unsectionedItems: ItemSummary[];
  archivedItems: ItemSummary[];
  canManage: boolean;
  groupBy: string;
  workspaceId: string;
  listId: string;
  boundAddSection: (formData: FormData) => Promise<void>;
  boundRenameSection: (formData: FormData) => Promise<void>;
  boundDuplicateSection: (formData: FormData) => Promise<void>;
  boundDeleteSection: (formData: FormData) => Promise<void>;
  boundMoveSection: (formData: FormData) => Promise<void>;
  boundSetGroupBy: (formData: FormData) => Promise<void>;
  boundAddItem: (formData: FormData) => Promise<void>;
  boundRestoreItem: (formData: FormData) => Promise<void>;
  boundCompleteItem: (formData: FormData) => Promise<void>;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [hideEmpty, setHideEmpty] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpenIds, setAddOpenIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(sectionId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function toggleAddOpen(key: string) {
    setAddOpenIds((current) => {
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

  const visibleSections = hideEmpty ? searchedSections.filter((section) => section.items.length > 0) : searchedSections;
  const showUnsectioned =
    searchedUnsectionedItems.length > 0 || (!hideEmpty && canManage && normalizedSearch === "");

  function handleNewTask() {
    const targetKey = visibleSections[0]?.id ?? UNSECTIONED_KEY;
    setShowArchived(false);
    setCollapsedIds((current) => {
      if (!current.has(targetKey)) return current;
      const next = new Set(current);
      next.delete(targetKey);
      return next;
    });
    setAddOpenIds((current) => new Set(current).add(targetKey));
    requestAnimationFrame(() => {
      document.getElementById(sectionDomId(targetKey))?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const chipClass = (active: boolean) =>
    active
      ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ff6b4a] bg-[#ff6b4a24] px-3 py-1 font-[family-name:var(--font-mono-label)] text-[10.5px] text-[#ff8a70] transition-colors duration-150"
      : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-3 py-1 font-[family-name:var(--font-mono-label)] text-[10.5px] text-ink-muted transition-colors duration-150 hover:text-ink";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-[6px] border border-line-strong bg-surface-2 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Items…"
              className="w-48 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          {canManage && (
            <RevealAddControl label="+ Section">
              <form action={boundAddSection} className="flex items-center gap-2">
                <input
                  type="text"
                  name="name"
                  placeholder="Section name"
                  required
                  autoFocus
                  className="rounded-[6px] border border-line-strong bg-surface-2 px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-[6px] bg-[#ff6b4a] px-3 py-[7px] text-[13px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]"
                >
                  Add
                </button>
              </form>
            </RevealAddControl>
          )}

          {canManage && (
            <form action={boundSetGroupBy} className="flex items-center gap-2">
              <select
                name="groupBy"
                defaultValue={groupBy}
                className="rounded-[6px] border border-line-strong bg-surface-2 px-3 py-1.5 text-[13px] text-ink"
              >
                <option value="SECTION">Section</option>
              </select>
              <button type="submit" className={chipClass(false)}>
                Add Rule: grouped by Section
              </button>
            </form>
          )}

          <button type="button" onClick={() => setHideEmpty((current) => !current)} className={chipClass(hideEmpty)}>
            Hide empty Sections
          </button>

          <button type="button" onClick={() => setShowArchived((current) => !current)} className={chipClass(showArchived)}>
            Archived ({archivedItems.length})
          </button>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleNewTask}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[6px] bg-[#ff6b4a] px-3 py-[7px] text-[13px] font-semibold text-[#1a0800] transition-colors duration-150 hover:bg-[#ff8a70]"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        )}
      </div>

      {showArchived ? (
        <div className="rounded-[12px] border border-line bg-surface-2 p-2">
          <div className="px-2.5 py-2 text-[13px] font-semibold text-ink">Archived Items</div>
          {archivedItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-ink-faint">No archived Items.</div>
          ) : (
            archivedItems.map((item) => (
              <ArchivedItemRow
                key={item.id}
                item={item}
                workspaceId={workspaceId}
                listId={listId}
                boundRestore={boundRestoreItem}
              />
            ))
          )}
        </div>
      ) : visibleSections.length === 0 && !showUnsectioned ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
          {normalizedSearch !== ""
            ? "No Items match your search."
            : sections.length === 0
              ? "No Sections yet."
              : "Every Section is empty — toggle “Hide empty Sections” off to see them."}
        </div>
      ) : (
        <div className="rounded-[12px] border border-line bg-surface-2 p-2">
          {visibleSections.map((section, index) => {
            const collapsed = collapsedIds.has(section.id);
            const isRenaming = renamingId === section.id;

            return (
              <div
                key={section.id}
                id={sectionDomId(section.id)}
                className={index > 0 ? "mt-2" : undefined}
              >
                <div className="flex items-center gap-2 px-2.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(section.id)}
                    aria-label={collapsed ? "Expand Section" : "Collapse Section"}
                    className="text-ink-faint transition-colors duration-150 hover:text-ink"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
                    />
                  </button>

                  {isRenaming ? (
                    <form
                      action={async (formData) => {
                        await boundRenameSection(formData);
                        setRenamingId(null);
                      }}
                      className="flex flex-1 items-center gap-2"
                    >
                      <input type="hidden" name="sectionId" value={section.id} />
                      <input
                        type="text"
                        name="name"
                        defaultValue={section.name}
                        autoFocus
                        className="flex-1 rounded-[6px] border border-line-strong bg-surface-3 px-2 py-1 text-[13px] text-ink transition-colors duration-150 focus:border-[#ff6b4a] focus:outline-none"
                      />
                      <button type="submit" className="text-xs text-[#ff8a70]">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-xs text-ink-faint transition-colors duration-150 hover:text-ink-muted"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : canManage ? (
                    <SectionNameMenu
                      name={section.name}
                      sectionId={section.id}
                      onRename={() => setRenamingId(section.id)}
                      boundDuplicateSection={boundDuplicateSection}
                      boundMoveSection={boundMoveSection}
                      boundDeleteSection={boundDeleteSection}
                    />
                  ) : (
                    <span className="text-[13px] font-semibold text-ink">{section.name}</span>
                  )}

                  {!isRenaming && <StatusBadge tone="muted">{section.items.length}</StatusBadge>}

                  <div className="flex-1" />

                  {canManage && !isRenaming && (
                    <SectionAddButton
                      open={addOpenIds.has(section.id)}
                      onToggle={() => toggleAddOpen(section.id)}
                    />
                  )}
                </div>

                {!collapsed && (
                  <div>
                    {section.items.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-ink-faint">No Items yet.</div>
                    ) : (
                      <>
                        <ColumnHeaders />
                        {section.items.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            workspaceId={workspaceId}
                            listId={listId}
                            indented={item.hasParent}
                            boundComplete={boundCompleteItem}
                          />
                        ))}
                      </>
                    )}
                    {canManage && addOpenIds.has(section.id) && (
                      <AddItemForm sectionId={section.id} boundAddItem={boundAddItem} autoFocus />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {showUnsectioned && (
            <div
              id={sectionDomId(UNSECTIONED_KEY)}
              className={visibleSections.length > 0 ? "mt-2" : undefined}
            >
              <div className="flex items-center gap-2 px-2.5 py-2.5">
                <span className="text-[13px] font-semibold text-ink">No Section</span>
                <StatusBadge tone="muted">{searchedUnsectionedItems.length}</StatusBadge>
                <div className="flex-1" />
                {canManage && (
                  <SectionAddButton
                    open={addOpenIds.has(UNSECTIONED_KEY)}
                    onToggle={() => toggleAddOpen(UNSECTIONED_KEY)}
                  />
                )}
              </div>
              {searchedUnsectionedItems.length > 0 && <ColumnHeaders />}
              {searchedUnsectionedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  workspaceId={workspaceId}
                  listId={listId}
                  indented={item.hasParent}
                  boundComplete={boundCompleteItem}
                />
              ))}
              {canManage && addOpenIds.has(UNSECTIONED_KEY) && (
                <AddItemForm sectionId={null} boundAddItem={boundAddItem} autoFocus />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
