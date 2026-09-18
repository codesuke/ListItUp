import { ArrowRight, Check, LayoutList } from "lucide-react";

import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import { StatusBadge, type StatusBadgeTone } from "@/components/workspace/StatusBadge";
import type { AssignedByMeItem } from "@/lib/item/item-assigned-by-me";
import type { MyTaskItem } from "@/lib/item/item-my-tasks";
import type { RecentListSummary } from "./page-data";

const STATE_COLOR: Record<MyTaskItem["state"], string> = {
  TO_DO: "#737373",
  IN_PROGRESS: "#5b9dff",
  BLOCKED: "#f5b642",
  COMPLETE: "#3ecf8e",
  ARCHIVED: "#525252",
};

function formatDueDate(dueDate: Date): string {
  return dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dueDateBadge(
  item: { state: MyTaskItem["state"]; dueDate: Date | null },
  now: Date
): { tone: StatusBadgeTone; label: string } {
  if (item.state === "COMPLETE") return { tone: "green", label: "Complete" };
  if (item.state === "BLOCKED") return { tone: "amber", label: "Blocked" };
  if (item.dueDate && item.dueDate.getTime() < now.getTime()) {
    return { tone: "red", label: `Overdue · ${formatDueDate(item.dueDate)}` };
  }
  if (item.dueDate) return { tone: "blue", label: `Due ${formatDueDate(item.dueDate)}` };
  return { tone: "muted", label: "No due date" };
}

function WidgetCard({
  label,
  headerRight,
  children,
}: {
  label: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-line bg-surface-2 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.1em] text-ink-faint">
          {label}
        </h2>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <a href={href} className="flex items-center gap-1 text-[12px] font-semibold text-[#ff8a70] transition-colors duration-150 hover:text-[#ff6b4a]">
      View all <ArrowRight className="h-3 w-3" />
    </a>
  );
}

function EmptyWidgetState({ message }: { message: string }) {
  return <p className="mt-4 text-sm text-ink-faint">{message}</p>;
}

export function MyTasksPreviewWidget({
  items,
  workspaceId,
  workspaceName,
  viewerName,
  now,
}: {
  items: MyTaskItem[];
  workspaceId: string;
  workspaceName: string;
  viewerName: string;
  now: Date;
}) {
  return (
    <WidgetCard
      label={`My Tasks — ${workspaceName}`}
      headerRight={<ViewAllLink href={`/my-tasks?workspace=${workspaceId}`} />}
    >
      {items.length === 0 ? (
        <EmptyWidgetState message="No Items assigned to you here — you're all caught up." />
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {items.map((item) => {
            const badge = dueDateBadge(item, now);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-surface-3"
              >
                <span
                  className={
                    item.state === "COMPLETE"
                      ? "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] bg-[#ff6b4a]"
                      : "h-4 w-4 flex-shrink-0 rounded-[5px] border-[1.5px] border-line-strong"
                  }
                >
                  {item.state === "COMPLETE" && <Check className="h-[11px] w-[11px] text-[#1a0800]" />}
                </span>
                <a
                  href={`/workspaces/${item.sourceWorkspaceId}/lists/${item.listId}/items/${item.id}`}
                  className="min-w-0 flex-1 truncate text-[13.5px] text-ink transition-colors duration-150 hover:underline"
                >
                  {item.title}
                </a>
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                <MemberAvatar name={viewerName} />
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

export function RecentListsWidget({
  lists,
  workspaceId,
}: {
  lists: RecentListSummary[];
  workspaceId: string;
}) {
  return (
    <WidgetCard label="Recent Lists">
      {lists.length === 0 ? (
        <EmptyWidgetState message="No Lists here yet." />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {lists.map((list) => (
            <li key={list.id}>
              <a href={`/workspaces/${workspaceId}/lists/${list.id}`} className="group flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-3">
                  <LayoutList className="h-4 w-4 text-[#ff8a70]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink transition-colors duration-150 group-hover:underline">
                    {list.name}
                  </span>
                  <span className="block text-[11.5px] text-ink-faint">
                    {list.itemCount} {list.itemCount === 1 ? "item" : "items"} · {list.completionPercent}% complete
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function AssignedByMeWidget({
  items,
  workspaceId,
  now,
}: {
  items: AssignedByMeItem[];
  workspaceId: string;
  now: Date;
}) {
  return (
    <WidgetCard
      label="Items I've Assigned"
      headerRight={
        <span className="text-[11px] text-ink-faint">Created by you, assigned to someone else</span>
      }
    >
      {items.length === 0 ? (
        <EmptyWidgetState message="You haven't assigned any Items to others here yet." />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
          {items.map((item) => {
            const badge = dueDateBadge(item, now);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-surface-3"
              >
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: STATE_COLOR[item.state] }}
                />
                <a
                  href={`/workspaces/${workspaceId}/lists/${item.listId}/items/${item.id}`}
                  className="min-w-0 flex-1 truncate text-[13.5px] text-ink transition-colors duration-150 hover:underline"
                >
                  {item.title}
                </a>
                <div className="flex flex-shrink-0 -space-x-1.5">
                  {item.assigneeNames.slice(0, 2).map((name) => (
                    <MemberAvatar key={name} name={name} />
                  ))}
                  {item.assigneeCount > 2 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-4 font-[family-name:var(--font-mono-label)] text-[10px] font-bold text-ink-muted">
                      +{item.assigneeCount - 2}
                    </span>
                  )}
                </div>
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
