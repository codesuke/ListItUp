"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { DraggableCard } from "@/components/board/DraggableCard";
import { DroppableColumn } from "@/components/board/DroppableColumn";
import { AssigneeAvatar } from "@/components/workspace/AssigneeAvatar";
import type { ListRoleEntry, ListRoles } from "@/lib/list/list-roles";

type RoleColumnKey = "LEAD" | "MEMBER" | "VIEWER" | "GUEST";

const ROLE_COLUMNS: { key: RoleColumnKey; label: string; removeLabel?: string }[] = [
  { key: "LEAD", label: "Lead" },
  { key: "MEMBER", label: "Member" },
  { key: "VIEWER", label: "Viewer" },
  { key: "GUEST", label: "Guest", removeLabel: "Revoke" },
];

function entriesForColumn(roles: ListRoles, key: RoleColumnKey): ListRoleEntry[] {
  switch (key) {
    case "LEAD":
      return roles.leads;
    case "MEMBER":
      return roles.members;
    case "VIEWER":
      return roles.viewers;
    case "GUEST":
      return roles.guests;
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

// The Roles panel's kanban (Workspace Owner/Admin only): dragging a person
// card between the Lead/Member/Viewer/Guest columns changes their List
// access, reusing the same DraggableCard/DroppableColumn pick-up-and-drop
// motion as the List Board (components/board/).
export function OverviewRolesBoard({
  roles,
  canRemove,
  canDrag,
  boundRemoveMember,
  boundRevokeGuest,
  boundMoveRole,
}: {
  roles: ListRoles;
  canRemove: boolean;
  canDrag: boolean;
  boundRemoveMember: (userId: string) => Promise<void>;
  boundRevokeGuest: (userId: string) => Promise<void>;
  boundMoveRole: (userId: string, toRole: RoleColumnKey) => Promise<void>;
}) {
  const [activeEntry, setActiveEntry] = useState<ListRoleEntry | null>(null);
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

    void boundMoveRole(userId, toRole);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveEntry(findEntry(roles, String(event.active.id))?.entry ?? null)}
      onDragCancel={() => setActiveEntry(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {ROLE_COLUMNS.map((column) => {
          const entries = entriesForColumn(roles, column.key);
          const boundRemove = column.key === "GUEST" ? boundRevokeGuest : boundRemoveMember;

          return (
            <div key={column.key} className="flex min-w-0 flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {column.label}
                </span>
                <span className="text-[11px] text-ink-muted">{entries.length}</span>
              </div>
              <div className="mt-2 border-t border-line" />
              <DroppableColumn id={column.key} className="mt-1 flex max-h-64 min-h-16 flex-col gap-1 overflow-y-auto">
                {entries.length === 0 ? (
                  <div className="py-2 text-sm text-ink-muted">No members</div>
                ) : (
                  entries.map((entry) => (
                    <DraggableCard key={entry.userId} id={entry.userId} disabled={!canDrag}>
                      <div className="group flex items-center gap-2">
                        <AssigneeAvatar name={entry.name} />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.name}</span>
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => void boundRemove(entry.userId)}
                            className="shrink-0 text-xs text-ink-muted opacity-0 transition-opacity duration-150 hover:text-[#ff8a70] focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            {column.removeLabel ?? "Remove"}
                          </button>
                        )}
                      </div>
                    </DraggableCard>
                  ))
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
  );
}
