import { AlertTriangle, Check, CornerDownRight, OctagonPause } from "lucide-react";

import { buildItemShareUrl } from "@/lib/item/item-sharing";
import {
  myTaskItemHref,
  myTaskRowBadge,
  myTaskWorkspaceLabel,
  type MyTaskItem,
  type MyTasksGroup,
  type MyTasksSmartSectionKey,
} from "@/lib/item/item-my-tasks";

import { CopyLinkButton } from "./CopyLinkButton";

// Section headers only get an icon + color for the two sections that need a
// User to notice them before anything else (design-mocks/my-tasks); every
// other key (a smart section's date buckets, or an explicit Group-by's
// Workspace/Priority/Due-date keys) falls back to a plain ink-muted label —
// a colored header for "Today" or "Upcoming" would compete with Overdue and
// Blocked for the same attention instead of giving way to them.
const SECTION_HEADER: Partial<Record<MyTasksSmartSectionKey, { colorVar: string; icon: React.ComponentType<{ className?: string }> }>> = {
  OVERDUE: { colorVar: "var(--accent-attention)", icon: AlertTriangle },
  BLOCKED: { colorVar: "var(--accent-blocked)", icon: OctagonPause },
};

function GroupHeader({ groupKey, label, count }: { groupKey: string; label: string; count: number }) {
  const decorated = SECTION_HEADER[groupKey as MyTasksSmartSectionKey];
  const Icon = decorated?.icon;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em]"
      style={{ color: decorated?.colorVar ?? "var(--ink-muted)" }}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      <span className="font-normal normal-case tracking-normal text-ink-muted">{count}</span>
    </div>
  );
}

// Reuses myTaskRowBadge's existing Blocked > Complete > Undated > Overdue >
// Today > future-date precedence (lib/item/item-my-tasks.ts) — only the
// phrasing and color change here, never which state wins. Complete and
// Undated are deliberately silent: the checkbox already tells the first
// story, and an absent due date is its own (quiet) signal rather than a
// label worth printing on every row.
function rowStatus(item: MyTaskItem, now: Date): { text: string; className: string } | null {
  const badge = myTaskRowBadge(item, now);
  switch (badge.tone) {
    case "green":
    case "muted":
      return null;
    case "red":
      return { text: `Overdue · ${badge.label}`, className: "font-medium text-[color:var(--accent-attention)]" };
    case "amber":
      return { text: badge.label, className: "text-[color:var(--accent-blocked)]" };
    default:
      return {
        text: badge.label === "Today" ? badge.label : `Due ${badge.label}`,
        className: "text-ink-muted",
      };
  }
}

function CompleteToggle({
  isComplete,
  isToggleable,
  boundComplete,
  boundUncomplete,
}: {
  isComplete: boolean;
  isToggleable: boolean;
  boundComplete: () => Promise<void>;
  boundUncomplete: () => Promise<void>;
}) {
  if (!isToggleable) {
    return isComplete ? (
      <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#ff6b4a]">
        <Check className="h-3 w-3 text-[#1a0800]" />
      </span>
    ) : (
      <span className="h-[18px] w-[18px] flex-shrink-0 rounded-full border-[1.5px] border-line-strong" />
    );
  }

  if (isComplete) {
    return (
      <form action={boundUncomplete}>
        <button
          type="submit"
          aria-label="Mark incomplete"
          className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#ff6b4a] transition-colors hover:bg-[#ff8a70] animate-in fade-in-0 zoom-in-90 duration-150"
        >
          <Check className="h-3 w-3 text-[#1a0800] animate-in fade-in-0 zoom-in-50 duration-200" />
        </button>
      </form>
    );
  }

  return (
    <form action={boundComplete}>
      <button
        type="submit"
        aria-label="Mark complete"
        className="h-[18px] w-[18px] flex-shrink-0 rounded-full border-[1.5px] border-line-strong transition-colors hover:border-[#ff6b4a]"
      />
    </form>
  );
}

function MyTaskRow({
  item,
  now,
  baseUrl,
  boundComplete,
  boundUncomplete,
}: {
  item: MyTaskItem;
  now: Date;
  baseUrl: string;
  boundComplete: () => Promise<void>;
  boundUncomplete: () => Promise<void>;
}) {
  const isComplete = item.state === "COMPLETE";
  const isToggleable = item.state !== "ARCHIVED";
  const status = rowStatus(item, now);

  return (
    <div className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] px-2.5 py-2.5 transition-colors hover:bg-surface-3">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
        <CompleteToggle
          isComplete={isComplete}
          isToggleable={isToggleable}
          boundComplete={boundComplete}
          boundUncomplete={boundUncomplete}
        />
        <a
          href={myTaskItemHref(item, item.id)}
          className={`flex min-w-0 flex-1 items-center truncate text-[14px] transition-colors hover:underline ${
            isComplete ? "text-ink-muted line-through" : "text-ink"
          }`}
        >
          {item.hasParent && <CornerDownRight className="mr-1 h-3 w-3 flex-shrink-0 text-ink-faint" />}
          <span className="truncate">{item.title}</span>
        </a>
      </div>

      <div className="ml-[30px] flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1 sm:ml-0">
        <span className="hidden flex-shrink-0 truncate text-[12.5px] text-ink-muted sm:block sm:max-w-[140px]">
          {myTaskWorkspaceLabel(item)}
        </span>

        {item.priority === "HIGH" && !isComplete && (
          <span className="flex flex-shrink-0 items-center gap-1.5 text-[12.5px] text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f2545b]" aria-hidden />
            High
          </span>
        )}

        {status && <span className={`flex-shrink-0 whitespace-nowrap text-[12.5px] ${status.className}`}>{status.text}</span>}

        <div className="flex flex-shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <CopyLinkButton url={buildItemShareUrl(baseUrl, item)} />
        </div>
      </div>
    </div>
  );
}

export function MyTasksList({
  groups,
  now,
  baseUrl,
  boundComplete,
  boundUncomplete,
}: {
  groups: MyTasksGroup<MyTaskItem>[];
  now: Date;
  baseUrl: string;
  boundComplete: (itemId: string) => () => Promise<void>;
  boundUncomplete: (itemId: string) => () => Promise<void>;
}) {
  const isEmpty = groups.every((group) => group.items.length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-20 text-center">
        <Check className="h-4 w-4 text-ink-faint" />
        <p className="text-[13.5px] text-ink-muted">Nothing needs your attention — you&apos;re all caught up.</p>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && <GroupHeader groupKey={group.key} label={group.label} count={group.items.length} />}
          {group.items.map((item) => (
            <MyTaskRow
              key={item.id}
              item={item}
              now={now}
              baseUrl={baseUrl}
              boundComplete={boundComplete(item.id)}
              boundUncomplete={boundUncomplete(item.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
