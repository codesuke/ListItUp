import { ArrowRight, Check, LayoutList, Users } from "lucide-react";

import { avatarColorForName, initialsFromName } from "@/lib/ui/member-display";
import type { AssignedByMeItem } from "@/lib/item/item-assigned-by-me";
import type { MyTaskItem, MyTasksGroup } from "@/lib/item/item-my-tasks";
import { describeNotification, type ActivityNotification } from "@/lib/notification/notification-inbox";
import type { MyTasksAttentionCount, RecentListSummary } from "./page-data";

type DueDateStatus = { text: string; tone: "overdue" | "neutral" };

function formatDueDate(dueDate: Date): string {
  return dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const MINUTE = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  if (diffMs < MINUTE) return "Just now";
  if (diffMs < HOUR) return `${Math.floor(diffMs / MINUTE)}m ago`;
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)}h ago`;
  if (diffMs < 7 * DAY) return `${Math.floor(diffMs / DAY)}d ago`;
  return formatDueDate(date);
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
      className="flex flex-shrink-0 items-center gap-1 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
    >
      View all <ArrowRight className="h-3 w-3" />
    </a>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="mt-3 text-sm text-ink-muted">{message}</p>;
}

export function WorkspaceShortcuts({ workspaceId }: { workspaceId: string }) {
  const shortcuts = [
    { label: "Lists", description: "Browse and create Lists", href: `/workspaces/${workspaceId}/lists`, Icon: LayoutList },
    { label: "Members", description: "See and invite people", href: `/workspaces/${workspaceId}/settings/members`, Icon: Users },
  ];

  return (
    <nav aria-label="Workspace shortcuts" className="mb-12 grid grid-cols-2 gap-4">
      {shortcuts.map(({ label, description, href, Icon }) => (
        <a
          key={href}
          href={href}
          className="group flex items-center gap-3 rounded-lg border border-line bg-surface-1 px-4 py-3 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
        >
          <Icon className="h-5 w-5 flex-shrink-0 text-ink-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">{label}</span>
            <span className="block text-xs text-ink-muted">{description}</span>
          </span>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5" />
        </a>
      ))}
    </nav>
  );
}

// The at-a-glance line under the "My Tasks" heading — only the sections
// worth acting on today (Overdue/Blocked/Today), never the full section
// list, so it reads as a quick status rather than a stat dashboard.
function AttentionGlance({ counts }: { counts: MyTasksAttentionCount[] }) {
  const visible = counts.filter((count) => count.count > 0);

  if (visible.length === 0) {
    return <p className="mt-1 text-sm text-ink-muted">You&rsquo;re all caught up.</p>;
  }

  return (
    <p className="mt-1 text-sm text-ink-muted">
      {visible.map((count, index) => (
        <span key={count.key}>
          {index > 0 && " · "}
          <span className={count.key === "OVERDUE" ? "font-semibold text-[color:var(--accent-attention)]" : "font-semibold text-ink"}>
            {count.count}
          </span>{" "}
          {count.label.toLowerCase()}
        </span>
      ))}
    </p>
  );
}

function TaskRow({ item, now }: { item: MyTaskItem; now: Date }) {
  const status = dueDateStatus(item, now);
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-3">
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
}

export function MyTasksPreviewWidget({
  sections,
  totalCount,
  attentionCounts,
  workspaceId,
  now,
}: {
  sections: MyTasksGroup<MyTaskItem>[];
  totalCount: number;
  attentionCounts: MyTasksAttentionCount[];
  workspaceId: string;
  now: Date;
}) {
  return (
    <section className="rounded-2xl bg-surface-2 p-4 shadow-sm sm:p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">My Tasks</h2>
          <AttentionGlance counts={attentionCounts} />
        </div>
        <ViewAllLink href={`/my-tasks?workspace=${workspaceId}`} />
      </div>

      {totalCount === 0 ? (
        <EmptyState message="No Items assigned to you here — you're all caught up." />
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.key}>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {section.label}
              </h3>
              <ul className="flex flex-col">
                {section.items.map((item) => (
                  <TaskRow key={item.id} item={item} now={now} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecentActivityWidget({
  activity,
  now,
}: {
  activity: ActivityNotification[];
  now: Date;
}) {
  return (
    <section className="pt-4 sm:pt-6 md:pt-7">
      <SectionHeading>Recent Activity</SectionHeading>

      {activity.length === 0 ? (
        <EmptyState message="Nothing recent — activity on your Items will show up here." />
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {activity.map((notification) => (
            <li key={notification.id} className="text-sm">
              <a href={notification.itemHref} className="transition-colors duration-150 hover:underline">
                <span className="text-ink-muted">{describeNotification(notification)} </span>
                <span className="font-medium text-ink">{notification.itemTitle}</span>
              </a>
              <p className="mt-0.5 text-xs text-ink-muted">{formatRelativeTime(notification.createdAt, now)}</p>
            </li>
          ))}
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
        <p className="mt-3 text-sm text-ink-muted">
          No Lists here yet.{" "}
          <a href={`/workspaces/${workspaceId}/lists`} className="text-ink underline">
            Create your first List
          </a>
        </p>
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
