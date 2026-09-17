"use client";

import type { ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// Shared by every Kanban-style Board (List Board, My Tasks Board) so the
// pick-up/hover motion stays identical everywhere a card is draggable.
export function DraggableCard({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={
        "rounded-md border border-line bg-surface-2 p-2 transition-all duration-200 ease-out will-change-transform " +
        (disabled
          ? ""
          : "cursor-grab touch-none hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/40 active:cursor-grabbing ") +
        (isDragging ? "opacity-30" : "opacity-100")
      }
    >
      {children}
    </div>
  );
}
