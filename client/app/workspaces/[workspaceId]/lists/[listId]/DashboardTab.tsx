import { Users } from "lucide-react";

import {
  BreakdownWidget,
  CountTile,
  DASHBOARD_CARD_CLASS,
  DASHBOARD_WIDGET_TITLE_CLASS,
  ProgressDonutWidget,
} from "@/components/workspace/DashboardWidgets";
import { MemberAvatar } from "@/components/workspace/MemberAvatar";
import type {
  AttentionAxis,
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

function formatAxisDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const OVER_TIME_AXIS_LABEL_COUNT = 5;

function CompletionOverTimeWidget({ points }: { points: CompletionOverTimePoint[] }) {
  const width = 480;
  const height = 130;
  const maxCompleted = Math.max(1, ...points.map((point) => point.cumulativeCompleted));
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coordinates = points.map((point, index) => ({
    x: index * stepX,
    y: height - (point.cumulativeCompleted / maxCompleted) * (height - 10) - 5,
  }));
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath =
    coordinates.length > 0
      ? `M${coordinates[0]!.x},${height} ${coordinates
          .map((point) => `L${point.x},${point.y}`)
          .join(" ")} L${coordinates[coordinates.length - 1]!.x},${height} Z`
      : "";

  const labelIndices = Array.from(
    new Set(
      points.length <= OVER_TIME_AXIS_LABEL_COUNT
        ? points.map((_, index) => index)
        : Array.from({ length: OVER_TIME_AXIS_LABEL_COUNT }, (_, step) =>
            Math.round((step / (OVER_TIME_AXIS_LABEL_COUNT - 1)) * (points.length - 1))
          )
    )
  );

  return (
    <div className={`${CARD_CLASS} p-5`}>
      <div className={`${WIDGET_TITLE_CLASS} mb-1`}>Completion Over Time</div>
      <div className={`${WHY_TAG_CLASS} mb-4`}>Is completion on track?</div>
      {points.length === 0 ? (
        <p className={EMPTY_STATE_CLASS}>No Items yet.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
            <defs>
              <linearGradient id="completion-over-time-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6b4a" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ff6b4a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="#232323" strokeWidth="1">
              <line x1="0" y1="20" x2={width} y2="20" />
              <line x1="0" y1="60" x2={width} y2="60" />
              <line x1="0" y1="100" x2={width} y2="100" />
            </g>
            <path d={areaPath} fill="url(#completion-over-time-area)" />
            <polyline
              points={linePoints}
              fill="none"
              stroke="#ff6b4a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {coordinates.map((point, index) => (
              <circle
                key={points[index]!.date}
                cx={point.x}
                cy={point.y}
                r={index === coordinates.length - 1 ? 3.5 : 3}
                fill="#ff6b4a"
              />
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10.5px] text-ink-faint">
            {labelIndices.map((index) => (
              <span key={points[index]!.date}>{formatAxisDate(points[index]!.date)}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

const RADAR_AXES: readonly AttentionAxis[] = ["TO_DO", "BLOCKED", "OVERDUE", "DONE"];
const RADAR_AXIS_VECTOR: Record<AttentionAxis, { dx: number; dy: number }> = {
  TO_DO: { dx: 0, dy: -1 },
  BLOCKED: { dx: 1, dy: 0 },
  OVERDUE: { dx: 0, dy: 1 },
  DONE: { dx: -1, dy: 0 },
};
const RADAR_CENTER = 90;
const RADAR_MAX_RADIUS = 70;
const RADAR_RING_RADII = [70, 52, 34];
const RADAR_MEMBER_COLORS = ["#ff6b4a", "#5b9dff", "#3ecf8e", "#f5b642"];

function radarPoint(axis: AttentionAxis, ratio: number): string {
  const { dx, dy } = RADAR_AXIS_VECTOR[axis];
  return `${RADAR_CENTER + dx * RADAR_MAX_RADIUS * ratio},${RADAR_CENTER + dy * RADAR_MAX_RADIUS * ratio}`;
}

function radarRingPoints(radius: number): string {
  return RADAR_AXES.map((axis) => radarPoint(axis, radius / RADAR_MAX_RADIUS)).join(" ");
}

function AttentionImbalanceWidget({ entries }: { entries: AttentionImbalanceEntry[] }) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <div className={`${WIDGET_TITLE_CLASS} mb-1`}>Attention Imbalance</div>
      <div className={`${WHY_TAG_CLASS} mb-2`}>Where is attention skewed across the List&apos;s people</div>
      {entries.length === 0 ? (
        <p className={EMPTY_STATE_CLASS}>No assigned Items yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <svg width="180" height="180" viewBox="0 0 180 180" className="flex-shrink-0">
            {RADAR_RING_RADII.map((radius) => (
              <polygon key={radius} points={radarRingPoints(radius)} fill="none" stroke="#232323" strokeWidth="1" />
            ))}
            <line
              x1={RADAR_CENTER}
              y1={RADAR_CENTER - RADAR_MAX_RADIUS}
              x2={RADAR_CENTER}
              y2={RADAR_CENTER + RADAR_MAX_RADIUS}
              stroke="#232323"
              strokeWidth="1"
            />
            <line
              x1={RADAR_CENTER - RADAR_MAX_RADIUS}
              y1={RADAR_CENTER}
              x2={RADAR_CENTER + RADAR_MAX_RADIUS}
              y2={RADAR_CENTER}
              stroke="#232323"
              strokeWidth="1"
            />
            {entries.map((entry, index) => {
              const color = RADAR_MEMBER_COLORS[index % RADAR_MEMBER_COLORS.length]!;
              const points = RADAR_AXES.map((axis) => radarPoint(axis, entry.normalized[axis])).join(" ");
              return <polygon key={entry.userId} points={points} fill={`${color}2e`} stroke={color} strokeWidth="2" />;
            })}
            <text x={RADAR_CENTER} y="12" textAnchor="middle" fontSize="9" fill="#8f8f8a">
              TO DO
            </text>
            <text x="172" y={RADAR_CENTER + 3} textAnchor="end" fontSize="9" fill="#8f8f8a">
              BLOCKED
            </text>
            <text x={RADAR_CENTER} y="174" textAnchor="middle" fontSize="9" fill="#8f8f8a">
              OVERDUE
            </text>
            <text x="8" y={RADAR_CENTER + 3} textAnchor="start" fontSize="9" fill="#8f8f8a">
              DONE
            </text>
          </svg>
          <div className="flex flex-col gap-2">
            {entries.map((entry, index) => (
              <div key={entry.userId} className="flex items-center gap-2 text-[12px] text-ink">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: RADAR_MEMBER_COLORS[index % RADAR_MEMBER_COLORS.length] }}
                />
                {entry.name}
              </div>
            ))}
            <div className="mt-1 text-[11px] text-ink-faint">Normalized per Member, not raw count.</div>
          </div>
        </div>
      )}
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
        <AttentionImbalanceWidget entries={attentionImbalance} />
      </div>

      <PeerComparisonCard
        enabled={peerComparisonEnabled}
        canToggle={canTogglePeerComparison}
        boundToggle={boundTogglePeerComparison}
      />
    </div>
  );
}
