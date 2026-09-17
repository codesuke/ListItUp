import { Users } from "lucide-react";

import {
  AttentionImbalanceWidget,
  BreakdownWidget,
  CompletionOverTimeWidget,
  CountTile,
  DASHBOARD_CARD_CLASS,
  DASHBOARD_WIDGET_TITLE_CLASS,
  ProgressDonutWidget,
} from "@/components/workspace/DashboardWidgets";
import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import type {
  AttentionImbalanceEntry,
  CompletionOverTimePoint,
  ContributionEntry,
  HeatmapCell,
  ItemCounts,
  SectionBreakdownEntry,
  StateBreakdownEntry,
} from "@/lib/report/list-dashboard";

const CARD_CLASS = DASHBOARD_CARD_CLASS;
const WIDGET_TITLE_CLASS = DASHBOARD_WIDGET_TITLE_CLASS;
const WHY_TAG_CLASS = "font-[family-name:var(--font-mono-label)] text-[9.5px] tracking-[0.06em] text-ink-faint";
const EMPTY_STATE_CLASS = "text-sm text-ink-faint";

const STATE_BAR_COLOR: Record<StateBreakdownEntry["state"], string> = {
  TO_DO: "bg-ink-faint",
  IN_PROGRESS: "bg-[#5b9dff]",
  BLOCKED: "bg-[#f5b642]",
  COMPLETE: "bg-[#3ecf8e]",
  ARCHIVED: "bg-[#525252]",
};

const HEATMAP_INTENSITY_COLOR: Record<HeatmapCell["intensity"], string> = {
  0: "#202020",
  1: "rgba(255,107,74,0.25)",
  2: "rgba(255,107,74,0.5)",
  3: "rgba(255,107,74,0.75)",
  4: "#ff6b4a",
};

function CompletionHeatmapWidget({ weeks }: { weeks: HeatmapCell[][] }) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <div className={`${WIDGET_TITLE_CLASS} mb-1`}>Completion Heatmap</div>
      <div className={`${WHY_TAG_CLASS} mb-4`}>Rhythm of work — aggregated, not per-Member</div>
      <div className="flex gap-[3px]">
        {weeks.map((week) => (
          <div key={week[0]!.date} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}: ${cell.count} completed`}
                className="h-[11px] w-[11px] rounded-[2.5px]"
                style={{ backgroundColor: HEATMAP_INTENSITY_COLOR[cell.intensity] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <span className="text-[10px] text-ink-faint">Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className="h-[11px] w-[11px] rounded-[2.5px]"
            style={{ backgroundColor: HEATMAP_INTENSITY_COLOR[level] }}
          />
        ))}
        <span className="text-[10px] text-ink-faint">More</span>
      </div>
    </div>
  );
}

function ContributionMapWidget({ entries }: { entries: ContributionEntry[] }) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <div className={`${WIDGET_TITLE_CLASS} mb-1`}>Contribution Map</div>
      <div className={`${WHY_TAG_CLASS} mb-4`}>Who is moving work forward — normalized rate, not raw count</div>
      {entries.length === 0 ? (
        <p className={EMPTY_STATE_CLASS}>No assigned Items yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.userId} className="flex items-center gap-3">
              <MemberAvatar name={entry.name} />
              <span className="w-24 flex-shrink-0 truncate text-[12.5px] text-ink">{entry.name}</span>
              <div className="h-2 flex-1 rounded-full bg-surface-4">
                <div className="h-2 rounded-full bg-[#ff6b4a]" style={{ width: `${entry.completionRatePercent}%` }} />
              </div>
              <span className="w-10 flex-shrink-0 text-right font-[family-name:var(--font-mono-label)] text-[11.5px] text-ink-muted">
                {entry.completionRatePercent}%
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 text-[11px] text-ink-faint">
        Completion rate = Items completed ÷ Items assigned. Never a raw count.
      </div>
    </div>
  );
}

function PeerComparisonToggle({ enabled }: { enabled: boolean }) {
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={enabled}
      aria-label="Peer comparison"
      className={`relative h-[19px] w-[34px] flex-shrink-0 rounded-full border transition-colors ${
        enabled ? "border-[#ff6b4a] bg-[#ff6b4a24]" : "border-line-strong bg-surface-4"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[13px] w-[13px] rounded-full transition-all ${
          enabled ? "left-[17px] bg-[#ff6b4a]" : "left-[2px] bg-ink-muted"
        }`}
      />
    </button>
  );
}

function PeerComparisonIndicator({ enabled }: { enabled: boolean }) {
  return (
    <div
      aria-label={`Peer comparison is ${enabled ? "on" : "off"}`}
      className={`relative h-[19px] w-[34px] flex-shrink-0 rounded-full border ${
        enabled ? "border-[#ff6b4a] bg-[#ff6b4a24]" : "border-line-strong bg-surface-4"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[13px] w-[13px] rounded-full ${
          enabled ? "left-[17px] bg-[#ff6b4a]" : "left-[2px] bg-ink-muted"
        }`}
      />
    </div>
  );
}

function PeerComparisonCard({
  enabled,
  canToggle,
  boundToggle,
}: {
  enabled: boolean;
  canToggle: boolean;
  boundToggle: () => Promise<void>;
}) {
  return (
    <div className={`${CARD_CLASS} flex items-center justify-between p-5`}>
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-4 w-4 text-ink-faint" />
        <div>
          <div className="text-[13px] font-semibold text-ink">Peer comparison</div>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Workspace-level, off by default. When enabled, unlocks a directly comparative view on top of the
            Contribution Map and Radar Chart above — still normalized metrics, never raw counts. Only a Workspace
            Owner or Admin can change this.
          </p>
        </div>
      </div>
      {canToggle ? (
        <form action={boundToggle}>
          <PeerComparisonToggle enabled={enabled} />
        </form>
      ) : (
        <PeerComparisonIndicator enabled={enabled} />
      )}
    </div>
  );
}

export function DashboardTab({
  counts,
  bySection,
  byState,
  completionOverTime,
  progressPercent,
  completionHeatmap,
  contributionMap,
  attentionImbalance,
  peerComparisonEnabled,
  canTogglePeerComparison,
  boundTogglePeerComparison,
}: {
  counts: ItemCounts;
  bySection: SectionBreakdownEntry[];
  byState: StateBreakdownEntry[];
  completionOverTime: CompletionOverTimePoint[];
  progressPercent: number;
  completionHeatmap: HeatmapCell[][];
  contributionMap: ContributionEntry[];
  attentionImbalance: AttentionImbalanceEntry[];
  peerComparisonEnabled: boolean;
  canTogglePeerComparison: boolean;
  boundTogglePeerComparison: () => Promise<void>;
}) {
  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <CountTile label="Total Items" value={counts.total} />
        <CountTile label="Completed" value={counts.completed} valueColor="#3ecf8e" />
        <CountTile label="Incomplete" value={counts.incomplete} />
        <CountTile label="Overdue" value={counts.overdue} valueColor="#f2545b" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <BreakdownWidget
          title="Breakdown by Section"
          total={counts.total}
          entries={bySection.map((entry) => ({
            label: entry.sectionName,
            count: entry.count,
            barColorClassName: "bg-[#ff6b4a]",
          }))}
        />
        <BreakdownWidget
          title="Breakdown by State"
          total={counts.total}
          entries={byState.map((entry) => ({
            label: entry.label,
            count: entry.count,
            barColorClassName: STATE_BAR_COLOR[entry.state],
          }))}
        />
        <ProgressDonutWidget percent={progressPercent} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CompletionOverTimeWidget points={completionOverTime} />
        <CompletionHeatmapWidget weeks={completionHeatmap} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <ContributionMapWidget entries={contributionMap} />
        <AttentionImbalanceWidget
          title="Attention Imbalance"
          whyTag="Where is attention skewed across the List's people"
          entries={attentionImbalance.map((entry) => ({
            key: entry.userId,
            name: entry.name,
            normalized: entry.normalized,
          }))}
          emptyMessage="No assigned Items yet."
          footnote="Normalized per Member, not raw count."
        />
      </div>

      <PeerComparisonCard
        enabled={peerComparisonEnabled}
        canToggle={canTogglePeerComparison}
        boundToggle={boundTogglePeerComparison}
      />
    </div>
  );
}
