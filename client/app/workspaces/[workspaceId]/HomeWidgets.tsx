import { ArrowRight, Check, LayoutList } from "lucide-react";

import { avatarColorForName, initialsFromName } from "@/lib/ui/member-display";
import type { AssignedByMeItem } from "@/lib/item/item-assigned-by-me";
import type { MyTaskItem } from "@/lib/item/item-my-tasks";
import type { RecentListSummary } from "./page-data";

type DueDateStatus = { text: string; tone: "overdue" | "neutral" };

function formatDueDate(dueDate: Date): string {
  return dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Complete Items and Items with no due date carry no status text — the
// checkbox already tells the first story, and an empty due date is not
// information worth printing on every row.
function dueDateStatus(item: { state: MyTaskItem["state"]; dueDate: Date | null }, now: Date): DueDateStatus | null {
  if (item.state === "COMPLETE") return null;
  if (item.state === "BLOCKED") return { text: "Blocked", tone: "neutral" };
  if (!item.dueDate) return null;
  if (item.dueDate.getTime() < now.getTime()) {
    return { text: `Overdue · ${formatDueDate(item.dueDate)}`, tone: "overdue" };
  }
  return { text: `Due ${formatDueDate(item.dueDate)}`, tone: "neutral" };
}

function DueDateText({ status }: { status: DueDateStatus }) {
  return (
    <span
      className={`flex-shrink-0 text-xs ${status.tone === "overdue" ? "font-medium text-[color:var(--accent-attention)]" : "text-ink-muted"}`}
    >
      {status.text}
    </span>
  );
}

// A local, Inter-set stand-in for the shared MemberAvatar — that component
// still renders initials in the app's old mono label font (other, as-yet
// unredesigned screens depend on it), which this calm surface doesn't use.
function AssigneeAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-2 text-[10px] font-semibold text-[#1a0800]"
      style={{ backgroundColor: avatarColorForName(name) }}
      title={name}
    >
      {initialsFromName(name)}
    </span>
  );
}

function SectionHeading({
  children,
  emphasis = "secondary",
  action,
}: {
  children: React.ReactNode;
  emphasis?: "primary" | "secondary";
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2
        className={
          emphasis === "primary"
            ? "text-base font-semibold text-ink"
            : "text-xs font-medium uppercase tracking-wide text-ink-muted"
        }
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-1 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
    >
      View all <ArrowRight className="h-3 w-3" />
    </a>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="mt-3 text-sm text-ink-muted">{message}</p>;
}

export function MyTasksPreviewWidget({
  items,
  workspaceId,
  now,
}: {
  items: MyTaskItem[];
  workspaceId: string;
  now: Date;
}) {
  return (
    <section>
      <SectionHeading emphasis="primary" action={<ViewAllLink href={`/my-tasks?workspace=${workspaceId}`} />}>
        My Tasks
      </SectionHeading>

      {items.length === 0 ? (
        <EmptyState message="No Items assigned to you here — you're all caught up." />
      ) : (
        <ul className="mt-3 flex flex-col">
          {items.map((item) => {
            const status = dueDateStatus(item, now);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-2"
              >
                <span
                  className={
                    item.state === "COMPLETE"
                      ? "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#ff6b4a]"
                      : "h-[18px] w-[18px] flex-shrink-0 rounded-full border-[1.5px] border-line-strong"
                  }
                >
                  {item.state === "COMPLETE" && <Check className="h-3 w-3 text-[#1a0800]" />}
                </span>
                <a
                  href={`/workspaces/${item.sourceWorkspaceId}/lists/${item.listId}/items/${item.id}`}
                  className={`min-w-0 flex-1 truncate text-[14px] transition-colors duration-150 hover:underline ${
                    item.state === "COMPLETE" ? "text-ink-muted line-through" : "text-ink"
                  }`}
                >
                  {item.title}
                </a>
                {status && <DueDateText status={status} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
    <section>
      <SectionHeading>Recent Lists</SectionHeading>

      {lists.length === 0 ? (
        <EmptyState message="No Lists here yet." />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {lists.map((list) => (
            <li key={list.id}>
              <a href={`/workspaces/${workspaceId}/lists/${list.id}`} className="group flex items-center gap-2.5">
                <LayoutList className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink transition-colors duration-150 group-hover:underline">
                    {list.name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {list.itemCount} {list.itemCount === 1 ? "item" : "items"} · {list.completionPercent}% complete
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <section>
      <SectionHeading>Assigned to Others</SectionHeading>

      {items.length === 0 ? (
        <EmptyState message="You haven't assigned any Items to others here yet." />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((item) => {
            const status = dueDateStatus(item, now);
            return (
              <li key={item.id} className="flex items-center gap-2.5">
                <div className="flex flex-shrink-0 -space-x-1.5">
                  {item.assigneeNames.slice(0, 2).map((name) => (
                    <AssigneeAvatar key={name} name={name} />
                  ))}
                  {item.assigneeCount > 2 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-2 bg-surface-3 text-[10px] font-medium text-ink-muted">
                      +{item.assigneeCount - 2}
                    </span>
                  )}
                </div>
                <a
                  href={`/workspaces/${workspaceId}/lists/${item.listId}/items/${item.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-ink transition-colors duration-150 hover:underline"
                >
                  {item.title}
                </a>
                {status && <DueDateText status={status} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
