"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { BlockerReasonDialog } from "@/components/board/BlockerReasonDialog";
import { DraggableCard } from "@/components/board/DraggableCard";
import { DroppableColumn } from "@/components/board/DroppableColumn";
import type { BoardColumn, BoardItem } from "@/lib/list/list-board";

import type { ItemSummary } from "./page-data";

const PRIORITY_LABEL: Record<BoardItem["priority"], string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
};

function MoveControl({
  item,
  columns,
  currentColumnKey,
  groupBy,
  boundMoveItem,
}: {
  item: BoardItem;
  columns: BoardColumn[];
  currentColumnKey: string;
  groupBy: string;
  boundMoveItem: (itemId: string, columnKey: string, blockerReason?: string) => Promise<void>;
}) {
  const [target, setTarget] = useState("");
  const [blockerReason, setBlockerReason] = useState("");
  const otherColumns = columns.filter((column) => column.key !== currentColumnKey);
  const needsBlockerReason = groupBy === "STATE" && target === "BLOCKED";

  return (
    <form
      action={async () => {
        await boundMoveItem(item.id, target, blockerReason || undefined);
        setTarget("");
        setBlockerReason("");
      }}
      className="mt-2 flex flex-col gap-1"
    >
      <select
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        className="rounded-md border border-line-strong bg-surface-1 px-2 py-1 text-xs text-ink"
      >
        <option value="">Move to…</option>
        {otherColumns.map((column) => (
          <option key={column.key} value={column.key}>
            {column.label}
          </option>
        ))}
      </select>
      {needsBlockerReason && (
        <input
          type="text"
          value={blockerReason}
          onChange={(event) => setBlockerReason(event.target.value)}
          placeholder="Blocker reason (required)"
          className="rounded-md border border-line-strong bg-surface-1 px-2 py-1 text-xs text-ink placeholder:text-ink-faint"
        />
      )}
      <button
        type="submit"
        disabled={!target || (needsBlockerReason && !blockerReason.trim())}
        className="self-start text-xs text-ink-muted transition-colors duration-150 hover:text-[#ff8a70] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Move
      </button>
    </form>
  );
}

export function BoardView({
  columns,
  groupBy,
  canManage,
  workspaceId,
  listId,
  archivedItems,
  boundSetGroupBy,
  boundMoveItem,
  boundRestoreItem,
}: {
  columns: BoardColumn[];
  groupBy: string;
  canManage: boolean;
  workspaceId: string;
  listId: string;
  archivedItems: ItemSummary[];
  boundSetGroupBy: (formData: FormData) => Promise<void>;
  boundMoveItem: (itemId: string, columnKey: string, blockerReason?: string) => Promise<void>;
  boundRestoreItem: (formData: FormData) => Promise<void>;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);
  const [pendingBlockerDrop, setPendingBlockerDrop] = useState<{ itemId: string; columnKey: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function findItem(itemId: string): { item: BoardItem; columnKey: string } | null {
    for (const column of columns) {
      const item = column.items.find((candidate) => candidate.id === itemId);
      if (item) {
        return { item, columnKey: column.key };
      }
    }
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const itemId = String(active.id);
    const targetColumnKey = String(over.id);
    const found = findItem(itemId);
    if (!found || found.columnKey === targetColumnKey) {
      return;
    }

    if (groupBy === "STATE" && targetColumnKey === "BLOCKED") {
      setPendingBlockerDrop({ itemId, columnKey: targetColumnKey });
      return;
    }

    void boundMoveItem(itemId, targetColumnKey);
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canManage && (
          <form action={boundSetGroupBy} className="flex items-center gap-2">
            <label className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Group by
            </label>
            <select
              name="groupBy"
              defaultValue={groupBy}
              className="rounded-md border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink"
            >
              <option value="STATE">State</option>
              <option value="SECTION">Section</option>
              <option value="ASSIGNEE">Assignee</option>
            </select>
            <button
              type="submit"
              className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-[#ff6b4a] hover:text-ink"
            >
              Apply
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className={
            showArchived
              ? "rounded-full border border-[#ff6b4a] px-3 py-1 text-xs text-[#ff8a70] transition-colors duration-150"
              : "rounded-full border border-line-strong px-3 py-1 text-xs text-ink-muted transition-colors duration-150 hover:text-ink"
          }
        >
          Archived ({archivedItems.length})
        </button>
      </div>

      {showArchived ? (
        <div className="rounded-lg border border-line bg-surface-1">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold text-ink">Archived</span>
            <span className="font-mono text-xs text-ink-faint">{archivedItems.length}</span>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {archivedItems.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-ink-faint">No archived Items.</div>
            ) : (
              archivedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-md border border-line bg-surface-2 p-2">
                  <a
                    href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
                    className="flex-1 truncate text-sm text-ink transition-colors duration-150 hover:text-ink hover:underline"
                  >
                    {item.title}
                  </a>
                  <form action={boundRestoreItem}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-line-strong px-3 py-1 text-xs text-ink transition-colors duration-150 hover:border-[#ff6b4a] hover:text-ink"
                    >
                      Restore
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(event) => setActiveItem(findItem(String(event.active.id))?.item ?? null)}
          onDragCancel={() => setActiveItem(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <div key={column.key} className="w-64 flex-shrink-0 rounded-lg border border-line bg-surface-1">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className="text-sm font-semibold text-ink">{column.label}</span>
                  <span className="font-mono text-xs text-ink-faint">{column.items.length}</span>
                </div>
                <DroppableColumn id={column.key} className="flex min-h-16 flex-col gap-2 p-2">
                  {column.items.map((item) => (
                    <DraggableCard key={item.id} id={item.id} disabled={!canManage}>
                      <a
                        href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
                        className="block text-sm text-ink transition-colors duration-150 hover:text-ink hover:underline"
                      >
                        {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
                        {item.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
                        {item.priority !== "NORMAL" && (
                          <span className="font-mono uppercase">{PRIORITY_LABEL[item.priority]}</span>
                        )}
                        {item.dueDate && (
                          <span className="font-mono">
                            {new Date(item.dueDate).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        {item.assignees.length > 0 && (
                          <span className="font-mono">{item.assignees.map((a) => a.name).join(", ")}</span>
                        )}
                      </div>
                      {canManage && (
                        <MoveControl
                          item={item}
                          columns={columns}
                          currentColumnKey={column.key}
                          groupBy={groupBy}
                          boundMoveItem={boundMoveItem}
                        />
                      )}
                    </DraggableCard>
                  ))}
                  {column.items.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-ink-faint">Empty</div>
                  )}
                </DroppableColumn>
              </div>
            ))}
          </div>
          <DragOverlay>
            {activeItem && (
              <div className="w-64 rotate-2 rounded-md border border-line-strong bg-surface-2 p-2 shadow-2xl">
                <span className="block text-sm text-ink">{activeItem.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {pendingBlockerDrop && (
        <BlockerReasonDialog
          onCancel={() => setPendingBlockerDrop(null)}
          onConfirm={(reason) => {
            void boundMoveItem(pendingBlockerDrop.itemId, pendingBlockerDrop.columnKey, reason);
            setPendingBlockerDrop(null);
          }}
        />
      )}
    </div>
  );
}
