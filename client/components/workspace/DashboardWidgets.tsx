import type { AttentionAxis, CompletionOverTimePoint } from "@/lib/report/list-dashboard";

// Shared by List Dashboard (app/workspaces/.../DashboardTab.tsx) and My
// Tasks Dashboard (app/my-tasks/page.tsx, #52) so the count-tile/breakdown
// card look stays identical across both without copy-adapting ~80 lines.
export const DASHBOARD_CARD_CLASS = "rounded-[12px] border border-line bg-surface-2";
export const DASHBOARD_WIDGET_TITLE_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.1em] text-ink-faint";
export const DASHBOARD_WHY_TAG_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[9.5px] tracking-[0.06em] text-ink-faint";
export const DASHBOARD_EMPTY_STATE_CLASS = "text-sm text-ink-faint";
const WHY_TAG_CLASS = DASHBOARD_WHY_TAG_CLASS;
const EMPTY_STATE_CLASS = DASHBOARD_EMPTY_STATE_CLASS;

export function CountTile({ label, value, valueColor }: { label: string; value: number; valueColor?: string }) {
  return (
    <div className={`${DASHBOARD_CARD_CLASS} p-4`}>
      <div className={DASHBOARD_WIDGET_TITLE_CLASS}>{label}</div>
      <div className="mt-2 text-[30px] font-bold tracking-[-0.02em]" style={{ color: valueColor ?? "#e5e5e0" }}>
        {value}
      </div>
    </div>
  );
}

export function BreakdownWidget({
  title,
  entries,
  total,
}: {
  title: string;
  entries: { label: string; count: number; barColorClassName: string }[];
  total: number;
}) {
  return (
    <div className={`${DASHBOARD_CARD_CLASS} p-5`}>
      <div className={`${DASHBOARD_WIDGET_TITLE_CLASS} mb-4`}>{title}</div>
      {entries.length === 0 ? (
        <p className={EMPTY_STATE_CLASS}>No Items yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.label}>
              <div className="mb-1 flex justify-between text-[12px]">
                <span className="text-ink-muted">{entry.label}</span>
                <span className="text-ink-faint">{entry.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-4">
                <div
                  className={`h-1.5 rounded-full ${entry.barColorClassName}`}
                  style={{ width: total > 0 ? `${(entry.count / total) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Progress graph (#49): how close a List — or, on My Tasks, the User's
// personal queue — is to done, aggregated only. Shared so both Dashboards
// render the identical donut off the same computeProgressPercent output
// (lib/report/list-dashboard.ts).
export function ProgressDonutWidget({ percent }: { percent: number }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / 100);

  return (
    <div className={`${DASHBOARD_CARD_CLASS} flex flex-col items-center justify-center p-5`}>
      <div className={`${DASHBOARD_WIDGET_TITLE_CLASS} mb-1 self-start`}>Progress</div>
      <div className={`${WHY_TAG_CLASS} mb-3 self-start`}>Toward fully done</div>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#202020" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#ff6b4a"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="66" textAnchor="middle" fontSize="24" fontWeight="700" fill="#e5e5e0">
          {percent}%
        </text>
      </svg>
    </div>
  );
}

function formatAxisDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const OVER_TIME_AXIS_LABEL_COUNT = 5;

export function CompletionOverTimeWidget({ points }: { points: CompletionOverTimePoint[] }) {
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
    <div className={`${DASHBOARD_CARD_CLASS} p-5`}>
      <div className={`${DASHBOARD_WIDGET_TITLE_CLASS} mb-1`}>Completion Over Time</div>
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

// Radar Chart (#51): one shape per series (a List Member, or the single
// "You" series on My Tasks) across the same four attention axes. Shared so
// both Dashboards render off the identical SVG geometry — only the series
// list, title, and framing copy differ between the per-Member and
// personal-only callers.
export type RadarChartEntry = { key: string; name: string; normalized: Record<AttentionAxis, number> };

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
const RADAR_SERIES_COLORS = ["#ff6b4a", "#5b9dff", "#3ecf8e", "#f5b642"];

function radarPoint(axis: AttentionAxis, ratio: number): string {
  const { dx, dy } = RADAR_AXIS_VECTOR[axis];
  return `${RADAR_CENTER + dx * RADAR_MAX_RADIUS * ratio},${RADAR_CENTER + dy * RADAR_MAX_RADIUS * ratio}`;
}

function radarRingPoints(radius: number): string {
  return RADAR_AXES.map((axis) => radarPoint(axis, radius / RADAR_MAX_RADIUS)).join(" ");
}

export function AttentionImbalanceWidget({
  title,
  whyTag,
  entries,
  emptyMessage,
  footnote,
}: {
  title: string;
  whyTag: string;
  entries: RadarChartEntry[];
  emptyMessage: string;
  footnote: string;
}) {
  return (
    <div className={`${DASHBOARD_CARD_CLASS} p-5`}>
      <div className={`${DASHBOARD_WIDGET_TITLE_CLASS} mb-1`}>{title}</div>
      <div className={`${WHY_TAG_CLASS} mb-2`}>{whyTag}</div>
      {entries.length === 0 ? (
        <p className={EMPTY_STATE_CLASS}>{emptyMessage}</p>
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
              const color = RADAR_SERIES_COLORS[index % RADAR_SERIES_COLORS.length]!;
              const points = RADAR_AXES.map((axis) => radarPoint(axis, entry.normalized[axis])).join(" ");
              return <polygon key={entry.key} points={points} fill={`${color}2e`} stroke={color} strokeWidth="2" />;
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
              <div key={entry.key} className="flex items-center gap-2 text-[12px] text-ink">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: RADAR_SERIES_COLORS[index % RADAR_SERIES_COLORS.length] }}
                />
                {entry.name}
              </div>
            ))}
            <div className="mt-1 text-[11px] text-ink-faint">{footnote}</div>
          </div>
        </div>
      )}
    </div>
  );
}
