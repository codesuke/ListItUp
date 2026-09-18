import type { ItemState } from "@/generated/prisma/client";
import { computeBarPosition, getTimelineDateRange, type TimelineItem } from "@/lib/list/list-timeline";

const STATE_BAR_COLOR: Record<ItemState, string> = {
  TO_DO: "bg-neutral-500",
  IN_PROGRESS: "bg-sky-500",
  BLOCKED: "bg-[#ff6b4a]",
  COMPLETE: "bg-emerald-500",
  ARCHIVED: "bg-neutral-700",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TimelineView({
  items,
  workspaceId,
  listId,
}: {
  items: TimelineItem[];
  workspaceId: string;
  listId: string;
}) {
  const range = getTimelineDateRange(items);

  if (!range) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-line px-4 py-16 text-center text-sm text-ink-faint">
        No Items with a due date yet.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        <span>{formatDate(range.start)}</span>
        <span>{formatDate(range.end)}</span>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-1 p-4">
        {items.map((item) => {
          const { leftPercent, widthPercent } = computeBarPosition(item, range);

          return (
            <div key={item.id} className="flex items-center gap-3">
              <a
                href={`/workspaces/${workspaceId}/lists/${listId}/items/${item.id}`}
                className="w-48 flex-shrink-0 truncate text-sm text-ink transition-colors duration-150 hover:text-ink hover:underline"
              >
                {item.hasParent && <span className="mr-1 text-ink-faint">↳</span>}
                {item.title}
              </a>
              <div className="relative h-5 flex-1 rounded bg-surface-2">
                <div
                  className={`absolute h-full rounded ${STATE_BAR_COLOR[item.state]}`}
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                  title={
                    item.startDate
                      ? `${formatDate(item.startDate)} – ${formatDate(item.dueDate)}`
                      : formatDate(item.dueDate)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
