import { ListChecks } from "lucide-react";

import {
  AttentionImbalanceWidget,
  BreakdownWidget,
  CompletionOverTimeWidget,
  CountTile,
  DASHBOARD_CARD_CLASS,
  DASHBOARD_EMPTY_STATE_CLASS,
  DASHBOARD_WHY_TAG_CLASS,
  DASHBOARD_WIDGET_TITLE_CLASS,
  ProgressDonutWidget,
} from "@/components/workspace/DashboardWidgets";
import type { ListContributionEntry } from "@/lib/report/list-dashboard";
import type { MyTasksDashboardData } from "./page-data";

const STATE_BAR_COLOR: Record<MyTasksDashboardData["byState"][number]["state"], string> = {
  TO_DO: "bg-ink-faint",
  IN_PROGRESS: "bg-[#5b9dff]",
  BLOCKED: "bg-[#f5b642]",
  COMPLETE: "bg-[#3ecf8e]",
  ARCHIVED: "bg-[#525252]",
};

// Personal Contribution Map (#50): "how consistently am I moving my own
// work forward" has no other-User axis on My Tasks, so it breaks the same
// normalized completion-rate metric List Dashboard's per-Member version
// uses (lib/report/list-dashboard.ts) down per source List instead — never
// another User's data, matching the personal-only guardrail.
function PersonalContributionWidget({ entries }: { entries: ListContributionEntry[] }) {
  return (
    <div className={`${DASHBOARD_CARD_CLASS} p-5`}>
      <div className={`${DASHBOARD_WIDGET_TITLE_CLASS} mb-1`}>Contribution Map</div>
      <div className={`${DASHBOARD_WHY_TAG_CLASS} mb-4`}>Your own pace — normalized rate, not raw count</div>
      {entries.length === 0 ? (
        <p className={DASHBOARD_EMPTY_STATE_CLASS}>No assigned Items yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.listId} className="flex items-center gap-3">
              <ListChecks className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
              <span className="w-28 flex-shrink-0 truncate text-[12.5px] text-ink">{entry.label}</span>
              <div className="h-2 flex-1 rounded-full bg-surface-4">
                <div
                  className="h-2 rounded-full bg-[#ff6b4a]"
                  style={{ width: `${entry.completionRatePercent}%` }}
                />
              </div>
              <span className="w-10 flex-shrink-0 text-right font-[family-name:var(--font-mono-label)] text-[11.5px] text-ink-muted">
                {entry.completionRatePercent}%
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 text-[11px] text-ink-faint">
        Completion rate per List = Items completed ÷ Items assigned there. Never shown for anyone else.
      </div>
    </div>
  );
}

// A trimmed personal Dashboard (design-mocks/my-tasks-dashboard, #46, #49,
// #50, #51) — counts, breakdowns, Completion-Over-Time, the Progress graph,
// a personal Contribution Map, and the personal Attention Imbalance radar,
// scoped to Items assigned to the User across every Workspace and their
// Personal Space. No heatmap/peer-comparison: those are separate,
// List Dashboard-specific widgets.
export function DashboardView({
  counts,
  byState,
  byList,
  completionOverTime,
  progressPercent,
  contributionByList,
  attentionImbalance,
}: MyTasksDashboardData) {
  // counts.total alone isn't a reliable empty-state signal here: a User
  // whose assigned Items are all IN_PROGRESS or ARCHIVED has counts.total
  // > 0 but nothing on any of the radar's four tracked axes, which would
  // render a degenerate all-zero shape instead of the empty state.
  const hasAttentionData = Object.values(attentionImbalance).some((value) => value > 0);

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <CountTile label="Total Assigned" value={counts.total} />
        <CountTile label="Completed" value={counts.completed} valueColor="#3ecf8e" />
        <CountTile label="Incomplete" value={counts.incomplete} />
        <CountTile label="Overdue" value={counts.overdue} valueColor="#f2545b" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <BreakdownWidget
          title="Breakdown by State"
          total={counts.total}
          entries={byState.map((entry) => ({
            label: entry.label,
            count: entry.count,
            barColorClassName: STATE_BAR_COLOR[entry.state],
          }))}
        />
        <BreakdownWidget
          title="Breakdown by List"
          total={counts.total}
          entries={byList.map((entry) => ({
            label: entry.label,
            count: entry.count,
            barColorClassName: "bg-[#ff6b4a]",
          }))}
        />
        <ProgressDonutWidget percent={progressPercent} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <CompletionOverTimeWidget points={completionOverTime} />
        <PersonalContributionWidget entries={contributionByList} />
        <AttentionImbalanceWidget
          title="Attention Imbalance"
          whyTag="Where your own attention is skewed"
          entries={hasAttentionData ? [{ key: "me", name: "You", normalized: attentionImbalance }] : []}
          emptyMessage="No assigned Items yet."
          footnote="Normalized against your own busiest state — never anyone else's data."
        />
      </div>

      <p className="text-[11.5px] text-ink-faint">
        A trimmed personal Dashboard — counts, breakdowns, completion trend, overall progress, your own contribution
        pace, and where your own attention is skewed, scoped to Items assigned to you across every Workspace and
        your Personal Space.
      </p>
    </div>
  );
}
