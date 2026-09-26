"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

import { ADD_BUTTON_PRIMARY } from "@/components/workspace/add-button";
import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { StatusBadge, TONE_CLASSES, type StatusBadgeTone } from "@/components/workspace/StatusBadge";

import type { ItemSummary, SectionWithItems } from "./page-data";

// Key used for the unsectioned Items group in the "add item" open/collapsed
// state map below — sections are keyed by their real id, and this group has
// none.
const UNSECTIONED_KEY = "__unsectioned__";

function sectionDomId(key: string): string {
  return `list-section-${key}`;
}

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

const STATUS_BADGE: Record<ItemSummary["state"], { tone: StatusBadgeTone; label: string }> = {
  TO_DO: { tone: "muted", label: "Open" },
  IN_PROGRESS: { tone: "blue", label: "In Progress" },
  BLOCKED: { tone: "amber", label: "Blocked" },
  COMPLETE: { tone: "green", label: "Complete" },
  ARCHIVED: { tone: "muted", label: "Archived" },
};

// Example, non-functional filter affordances — the row/section restructure
// this component ships doesn't wire real multi-facet filtering yet, but the
// toolbar still needs the pill+chevron control to occupy its place.
const FILTER_PILLS = ["All Workspaces", "Priority", "Due date", "Assignee"];

// One grid template, shared by every task row in every Section card, so a
// field's horizontal position never depends on what any row puts inside it
// — every non-Task track is a hardcoded pixel width (never auto/min-content)
// sized for each column's longest real value ("In Progress", "Normal", a
// long Assignee name), so a wider word can never shift the columns after it.
const ROW_GRID_COLS = "grid-cols-[minmax(0,1fr)_100px_180px_100px_130px_32px]";

// Shared horizontal inset for every row so a column's left edge never
// depends on row-specific state — subtask indentation is drawn *inside* the
// Task cell instead (see `ItemRow`).
const ROW_INSET = "px-3";

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

// Exactly one pill per row: an Item's category Label takes priority over its
// Priority level so a row never shows both at once. Wrapped in a full-width,
// right-justified flex container (rather than returned as a bare `w-fit`
// grid item) so the pill's right edge — not its left edge — stays fixed
// regardless of "HIGH" vs "NORMAL" width.
function BadgeCell({ item }: { item: ItemSummary }) {
  if (item.labels.length > 0) {
    return (
      <div className="flex w-full justify-end">
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-2.5 py-[3px] font-[family-name:var(--font-mono-label)] text-[10.5px] text-ink-muted">
          {item.labels[0].name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-end">
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full bg-surface-4 px-2.5 py-[3px] font-[family-name:var(--font-mono-label)] text-[10.5px] font-semibold uppercase tracking-[0.04em] ${PRIORITY_COLOR[item.priority]}`}
      >
        {PRIORITY_LABEL[item.priority]}
      </span>
    </div>
  );
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
      <MemberAvatar name={assignee.name} />
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

// Right-justified so the pill's right edge is constant regardless of
// "Open" vs "In Progress" vs "Complete" width.
function StatusPill({ state }: { state: ItemSummary["state"] }) {
  const { tone, label } = STATUS_BADGE[state];
  return (
    <div className="flex w-full justify-end">
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] font-[family-name:var(--font-mono-label)] text-[10.5px] font-semibold tracking-[0.04em] ${TONE_CLASSES[tone]}`}
      >
        {label}
      </span>
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
      className={`grid ${ROW_GRID_COLS} items-center gap-4 rounded-[8px] ${ROW_INSET} py-2.5 transition-colors duration-150 hover:bg-surface-3`}
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
      <BadgeCell item={item} />
      <AssigneeCell assignees={item.assignees} />
      <DueDateCell dueDate={item.dueDate} />
      <StatusPill state={item.state} />
      <div className="flex justify-end">
        <ItemActionsButton itemTitle={item.title} />
      </div>
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
    <form action={boundAddItem} className={`flex items-center gap-2 ${ROW_INSET} py-2`}>
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

function FilterPillButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
    >
      {label}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}

function SectionCard({
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
    <div className="rounded-[14px] border border-line bg-surface-2 p-2">
      <div className={`flex items-center gap-2 ${ROW_INSET} py-3`}>
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
        <StatusBadge tone="muted">{count}</StatusBadge>
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
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-shrink-0 items-center gap-2 rounded-[8px] border border-line-strong bg-surface-2 px-3 py-2">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Items…"
            className="w-52 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTER_PILLS.map((label) => (
            <FilterPillButton key={label} label={label} />
          ))}
        </div>

        <div className="flex-1" />

        {canManage && (
          <button type="button" onClick={handleNewTask} className={ADD_BUTTON_PRIMARY}>
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        )}
      </div>

      {searchedSections.length === 0 && !showUnsectioned ? (
        <div className="rounded-[14px] border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
          {normalizedSearch !== "" ? "No Items match your search." : "No Sections yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {searchedSections.map((section) => (
            <div key={section.id} id={sectionDomId(section.id)}>
              <SectionCard
                name={section.name}
                count={section.items.length}
                collapsed={collapsedIds.has(section.id)}
                onToggleCollapse={() => toggleCollapsed(section.id)}
              >
                {section.items.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-ink-faint">No Items yet.</div>
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
                  <AddItemForm sectionId={section.id} boundAddItem={boundAddItem} autoFocus />
                )}
              </SectionCard>
            </div>
          ))}

          {showUnsectioned && (
            <div id={sectionDomId(UNSECTIONED_KEY)}>
              <SectionCard
                name="No Section"
                count={searchedUnsectionedItems.length}
                collapsed={collapsedIds.has(UNSECTIONED_KEY)}
                onToggleCollapse={() => toggleCollapsed(UNSECTIONED_KEY)}
              >
                {searchedUnsectionedItems.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-ink-faint">No Items yet.</div>
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
                  <AddItemForm sectionId={null} boundAddItem={boundAddItem} autoFocus />
                )}
              </SectionCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
