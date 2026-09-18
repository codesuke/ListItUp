"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { BlockerReasonDialog } from "@/components/board/BlockerReasonDialog";
import { DraggableCard } from "@/components/board/DraggableCard";
import { DroppableColumn } from "@/components/board/DroppableColumn";
import { myTaskItemHref, myTaskWorkspaceLabel, type MyTaskItem } from "@/lib/item/item-my-tasks";
import type { MyTasksBoardColumn, MyTasksBoardGroupBy } from "@/lib/item/item-my-tasks-board";

const PRIORITY_LABEL: Record<MyTaskItem["priority"], string> = {
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
  item: MyTaskItem;
  columns: MyTasksBoardColumn[];
  currentColumnKey: string;
  groupBy: MyTasksBoardGroupBy;
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
  boundMoveItem,
}: {
  columns: MyTasksBoardColumn[];
  groupBy: MyTasksBoardGroupBy;
  boundMoveItem: (itemId: string, columnKey: string, blockerReason?: string) => Promise<void>;
}) {
  // WORKSPACE grouping is view-only — an Item's source Workspace is fixed
  // by which List it lives in, so there's nothing sensible to move it to
  // (see moveMyTaskItemToColumn's WORKSPACE branch).
  const canMove = groupBy !== "WORKSPACE";

  const [activeItem, setActiveItem] = useState<MyTaskItem | null>(null);
  const [pendingBlockerDrop, setPendingBlockerDrop] = useState<{ itemId: string; columnKey: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function findItem(itemId: string): { item: MyTaskItem; columnKey: string } | null {
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
    <div className="mt-4">
      {columns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
          No Items here — you&apos;re all caught up.
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
                    <DraggableCard key={item.id} id={item.id} disabled={!canMove}>
                      <a
                        href={myTaskItemHref(item, item.id)}
                        className="block text-sm text-ink hover:text-ink hover:underline"
                      >
                        {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
                        {item.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
                        <span className="font-mono uppercase tracking-wider">{myTaskWorkspaceLabel(item)}</span>
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
                      </div>
                      {canMove && (
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
