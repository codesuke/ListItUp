"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { DraggableCard } from "@/components/board/DraggableCard";
import { DroppableColumn } from "@/components/board/DroppableColumn";
import { AssigneeAvatar } from "@/components/workspace/AssigneeAvatar";
import type { ListRoleActionResult } from "./actions";
import type { ListRoleEntry, ListRoles } from "@/lib/list/list-roles";

type RoleColumnKey = "LEAD" | "MEMBER" | "VIEWER";

const ROLE_COLUMNS: { key: RoleColumnKey; label: string }[] = [
  { key: "LEAD", label: "Lead" },
  { key: "MEMBER", label: "Member" },
  { key: "VIEWER", label: "Viewer" },
];

function entriesForColumn(roles: ListRoles, key: RoleColumnKey): ListRoleEntry[] {
  switch (key) {
    case "LEAD":
      return roles.leads;
    case "MEMBER":
      return roles.members;
    case "VIEWER":
      return roles.viewers;
  }
}

function findEntry(roles: ListRoles, userId: string): { entry: ListRoleEntry; columnKey: RoleColumnKey } | null {
  for (const column of ROLE_COLUMNS) {
    const entry = entriesForColumn(roles, column.key).find((candidate) => candidate.userId === userId);
    if (entry) {
      return { entry, columnKey: column.key };
    }
  }
  return null;
}

// The Roles panel's kanban (List Lead threshold, same as the panel's other
// controls): dragging a person card between the Lead/Member/Viewer
// columns changes their List access, reusing the same DraggableCard/
// DroppableColumn pick-up-and-drop motion as the List Board
// (components/board/).
export function OverviewRolesBoard({
  roles,
  currentUserId,
  canManageRoles,
  canDrag,
  boundRemoveMember,
  boundMoveRole,
  boundPromoteToLead,
  boundStepDown,
}: {
  roles: ListRoles;
  currentUserId: string;
  // Gates every per-row Roles-panel control: Remove, Make Lead, and
  // Step down (>=LEAD access — see ListPageData.canEditDescription).
  canManageRoles: boolean;
  canDrag: boolean;
  boundRemoveMember: (userId: string) => Promise<ListRoleActionResult>;
  boundMoveRole: (userId: string, toRole: RoleColumnKey) => Promise<ListRoleActionResult>;
  boundPromoteToLead: (userId: string) => Promise<ListRoleActionResult>;
  boundStepDown: (userId: string) => Promise<ListRoleActionResult>;
}) {
  const [activeEntry, setActiveEntry] = useState<ListRoleEntry | null>(null);
  // Surfaces the last guarded action's block reason (most commonly #95's
  // "last-lead" message) — one shared line rather than per-row state, since
  // only one Roles-panel action is ever in flight at a time.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const userId = String(active.id);
    const toRole = over.id as RoleColumnKey;
    const found = findEntry(roles, userId);
    if (!found || found.columnKey === toRole) {
      return;
    }

    void boundMoveRole(userId, toRole).then((result) => {
      setErrorMessage(result.status === "error" ? result.message : null);
    });
  }

  async function runGuardedAction(action: (userId: string) => Promise<ListRoleActionResult>, userId: string) {
    const result = await action(userId);
    setErrorMessage(result.status === "error" ? result.message : null);
  }

  const rowButtonClass =
    "shrink-0 text-xs text-ink-muted opacity-0 transition-opacity duration-150 hover:text-[#ff8a70] focus-visible:opacity-100 group-hover:opacity-100";

  return (
    <div className="flex flex-col gap-2">
      {errorMessage ? (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        onDragStart={(event) => setActiveEntry(findEntry(roles, String(event.active.id))?.entry ?? null)}
        onDragCancel={() => setActiveEntry(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
          {ROLE_COLUMNS.map((column) => {
            const entries = entriesForColumn(roles, column.key);

            return (
              <div key={column.key} className="flex min-w-0 flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {column.label}
                  </span>
                  <span className="text-[11px] text-ink-muted">{entries.length}</span>
                </div>
                <div className="mt-2 border-t border-line" />
                <DroppableColumn
                  id={column.key}
                  className="mt-1 flex max-h-64 min-h-16 flex-col gap-1 overflow-y-auto"
                >
                  {entries.length === 0 ? (
                    <div className="py-2 text-sm text-ink-muted">No members</div>
                  ) : (
                    entries.map((entry) => {
                      // "Make Lead" offers Member/Viewer rows a promotion;
                      // "Step down" offers the viewer's own Lead row a way
                      // to give it up — the two controls never both apply
                      // to the same row (#95).
                      const canPromoteToLead =
                        canManageRoles && (column.key === "MEMBER" || column.key === "VIEWER");
                      const canStepDown =
                        canManageRoles && column.key === "LEAD" && entry.userId === currentUserId;

                      return (
                        <DraggableCard key={entry.userId} id={entry.userId} disabled={!canDrag}>
                          <div className="group flex items-center gap-2">
                            <AssigneeAvatar name={entry.name} />
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.name}</span>
                            {canPromoteToLead && (
                              <button
                                type="button"
                                onClick={() => void runGuardedAction(boundPromoteToLead, entry.userId)}
                                className={rowButtonClass}
                              >
                                Make Lead
                              </button>
                            )}
                            {canStepDown && (
                              <button
                                type="button"
                                onClick={() => void runGuardedAction(boundStepDown, entry.userId)}
                                className={rowButtonClass}
                              >
                                Step down
                              </button>
                            )}
                            {canManageRoles && (
                              <button
                                type="button"
                                onClick={() => void runGuardedAction(boundRemoveMember, entry.userId)}
                                className={rowButtonClass}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </DraggableCard>
                      );
                    })
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeEntry && (
            <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-2 p-2 shadow-2xl">
              <AssigneeAvatar name={activeEntry.name} />
              <span className="text-sm text-ink">{activeEntry.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
