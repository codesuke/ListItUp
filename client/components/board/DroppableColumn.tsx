"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

export function DroppableColumn({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={
        (className ?? "") +
        " rounded-md transition-colors duration-200 " +
        (isOver ? "bg-surface-3 ring-1 ring-inset ring-[#ff6b4a]/60" : "")
      }
    >
      {children}
    </div>
  );
}
