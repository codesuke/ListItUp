"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Link2,
  MessageSquare,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";

import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { StatusBadge, type StatusBadgeTone } from "@/components/workspace/StatusBadge";

import type { ItemSummary, SectionWithItems } from "./page-data";

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

function itemBadge(item: ItemSummary): { tone: StatusBadgeTone; label: string } | null {
  if (item.state === "COMPLETE") return { tone: "green", label: "Complete" };
  if (item.state === "BLOCKED") return { tone: "amber", label: "Blocked" };
  if (item.dueDate) {
    return {
      tone: "blue",
      label: item.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  }
  return { tone: "muted", label: "Undated" };
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
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] bg-[#ff6b4a]">
        <Check className="h-[11px] w-[11px] text-[#1a0800]" />
      </span>
    );
  }

  return (
    <form action={boundComplete}>
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        aria-label="Mark complete"
        className="h-4 w-4 flex-shrink-0 rounded-[5px] border-[1.5px] border-line-strong transition-colors hover:border-[#ff6b4a]"
      />
    </form>
  );
}

function FacetIcon({ icon: Icon, count }: { icon: React.ComponentType<{ className?: string }>; count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-[3px] font-[family-name:var(--font-mono-label)] text-[11px] text-ink-faint">
      <Icon className="h-3 w-3" /> {count}
    </span>
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
  const badge = itemBadge(item);

  return (
    <div
      className={`flex items-center gap-2.5 rounded-[8px] py-2 pr-2.5 transition-colors hover:bg-surface-3 ${
        indented ? "pl-[52px]" : "pl-2.5"
      }`}
    >
      <CompleteToggle checked={item.state === "COMPLETE"} itemId={item.id} boundComplete={boundComplete} />
      {!indented && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: STATE_DOT_COLOR[item.state] }} />}
      <Link
        href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
        className={`min-w-0 flex-1 truncate text-[13.5px] hover:underline ${
          item.state === "COMPLETE" ? "text-ink-faint line-through" : "text-ink"
        }`}
      >
        {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
        {item.title}
      </Link>
      {item.priority !== "NORMAL" && (
        <span className="whitespace-nowrap font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.04em] text-ink-muted">
          {PRIORITY_LABEL[item.priority]}
        </span>
      )}
      {item.labels.map((label) => (
        <span
          key={label.id}
          className="whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-2 py-0.5 font-[family-name:var(--font-mono-label)] text-[10.5px] text-ink-muted"
        >
          {label.name}
        </span>
      ))}
      <FacetIcon icon={Link2} count={item.dependencyCount} />
      <FacetIcon icon={MessageSquare} count={item.noteCount} />
      <FacetIcon icon={Paperclip} count={item.attachmentCount} />
      <div className="flex flex-shrink-0 -space-x-1.5">
        {item.assignees.map((assignee) => (
          <MemberAvatar key={assignee.userId} name={assignee.name} />
        ))}
      </div>
      {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
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
        className="min-w-0 flex-1 truncate text-[13.5px] text-ink-muted hover:text-ink hover:underline"
      >
        {item.title}
      </Link>
      <form action={boundRestore}>
        <input type="hidden" name="itemId" value={item.id} />
        <button
          type="submit"
          className="rounded-[6px] border border-line-strong px-3 py-1 text-xs text-ink-muted hover:border-[#ff6b4a] hover:text-ink"
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
}: {
  sectionId: string | null;
  boundAddItem: (formData: FormData) => Promise<void>;
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
        className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <button type="submit" className="text-xs text-ink-faint hover:text-[#ff8a70]">
        Add
      </button>
    </form>
  );
}

function SectionActionButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-ink-faint hover:bg-surface-4 hover:text-ink"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function SectionActionForm({
  label,
  action,
  hiddenFields,
  icon: Icon,
}: {
  label: string;
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <form action={action}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-ink-faint hover:bg-surface-4 hover:text-ink"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </form>
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

  const visibleSections = hideEmpty ? sections.filter((section) => section.items.length > 0) : sections;
  const showUnsectioned = unsectionedItems.length > 0 || (!hideEmpty && canManage);

  const chipClass = (active: boolean) =>
    active
      ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ff6b4a] bg-[#ff6b4a24] px-3 py-1 font-[family-name:var(--font-mono-label)] text-[10.5px] text-[#ff8a70]"
      : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-3 py-1 font-[family-name:var(--font-mono-label)] text-[10.5px] text-ink-muted hover:text-ink";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canManage && (
          <form action={boundAddSection} className="flex items-center gap-2">
            <input
              type="text"
              name="name"
              placeholder="New Section name"
              required
              className="rounded-[6px] border border-line-strong bg-surface-2 px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-[#ff6b4a] focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-[6px] bg-[#ff6b4a] px-3 py-[7px] text-[13px] font-semibold text-[#1a0800] hover:bg-[#ff8a70]"
            >
              Add Section
            </button>
          </form>
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
            <button
              type="submit"
              className={chipClass(false)}
            >
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
          {sections.length === 0
            ? "No Sections yet."
            : "Every Section is empty — toggle “Hide empty Sections” off to see them."}
        </div>
      ) : (
        <div className="rounded-[12px] border border-line bg-surface-2 p-2">
          {visibleSections.map((section, index) => {
            const collapsed = collapsedIds.has(section.id);
            const isRenaming = renamingId === section.id;

            return (
              <div key={section.id} className={index > 0 ? "mt-2" : undefined}>
                <div className="flex items-center gap-2 px-2.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(section.id)}
                    aria-label={collapsed ? "Expand Section" : "Collapse Section"}
                    className="text-ink-faint hover:text-ink"
                  >
                    {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                        className="flex-1 rounded-[6px] border border-line-strong bg-surface-3 px-2 py-1 text-[13px] text-ink focus:border-[#ff6b4a] focus:outline-none"
                      />
                      <button type="submit" className="text-xs text-[#ff8a70]">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-xs text-ink-faint hover:text-ink-muted"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <span className="text-[13px] font-semibold text-ink">{section.name}</span>
                  )}

                  {!isRenaming && <StatusBadge tone="muted">{section.items.length}</StatusBadge>}

                  <div className="flex-1" />

                  {canManage && !isRenaming && (
                    <div className="flex items-center gap-0.5">
                      <SectionActionButton label="Rename Section" icon={Pencil} onClick={() => setRenamingId(section.id)} />
                      <SectionActionForm
                        label="Duplicate Section"
                        icon={Copy}
                        action={boundDuplicateSection}
                        hiddenFields={{ sectionId: section.id }}
                      />
                      <SectionActionForm
                        label="Move Section up"
                        icon={ChevronUp}
                        action={boundMoveSection}
                        hiddenFields={{ sectionId: section.id, direction: "up" }}
                      />
                      <SectionActionForm
                        label="Move Section down"
                        icon={ChevronDown}
                        action={boundMoveSection}
                        hiddenFields={{ sectionId: section.id, direction: "down" }}
                      />
                      <SectionActionForm
                        label="Delete Section"
                        icon={Trash2}
                        action={boundDeleteSection}
                        hiddenFields={{ sectionId: section.id }}
                      />
                    </div>
                  )}
                </div>

                {!collapsed && (
                  <div>
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
                    {canManage && <AddItemForm sectionId={section.id} boundAddItem={boundAddItem} />}
                  </div>
                )}
              </div>
            );
          })}

          {showUnsectioned && (
            <div className={visibleSections.length > 0 ? "mt-2" : undefined}>
              <div className="flex items-center gap-2 px-2.5 py-2.5">
                <span className="text-[13px] font-semibold text-ink">No Section</span>
                <StatusBadge tone="muted">{unsectionedItems.length}</StatusBadge>
              </div>
              {unsectionedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  workspaceId={workspaceId}
                  listId={listId}
                  indented={item.hasParent}
                  boundComplete={boundCompleteItem}
                />
              ))}
              {canManage && <AddItemForm sectionId={null} boundAddItem={boundAddItem} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
