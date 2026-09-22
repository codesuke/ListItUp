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
const RADAR_VIEWBOX = 200;
const RADAR_CENTER = 100;
const RADAR_MAX_RADIUS = 58;
const RADAR_RING_RADII = [RADAR_MAX_RADIUS, (RADAR_MAX_RADIUS * 2) / 3, RADAR_MAX_RADIUS / 3];
const RADAR_SERIES_COLORS = ["#ff6b4a", "#5b9dff", "#3ecf8e", "#f5b642"];
// Muted-but-legible ink-faint tone (see globals.css dark theme --ink-faint):
// visibly lighter than the card border (--line, #232323) used previously, but
// still dimmer than the axis-label gray (#8f8f8a) so the grid stays subordinate.
const RADAR_GRID_COLOR = "#5a5a56";
const RADAR_AXIS_LABELS: Record<AttentionAxis, string> = {
  TO_DO: "TO DO",
  BLOCKED: "BLOCKED",
  OVERDUE: "OVERDUE",
  DONE: "DONE",
};
// Fixed gap kept between the shape's outer radius and its axis label so a
// vertex sitting at ratio 1 (the max normalized value) never touches the
// label text.
const RADAR_LABEL_GAP = 14;
const RADAR_LABEL_RADIUS = RADAR_MAX_RADIUS + RADAR_LABEL_GAP;
const RADAR_LABEL_BASELINE_NUDGE = 3;

function radarVertex(axis: AttentionAxis, ratio: number): { x: number; y: number } {
  const { dx, dy } = RADAR_AXIS_VECTOR[axis];
  return { x: RADAR_CENTER + dx * RADAR_MAX_RADIUS * ratio, y: RADAR_CENTER + dy * RADAR_MAX_RADIUS * ratio };
}

function radarPoints(entry: RadarChartEntry): { x: number; y: number }[] {
  return RADAR_AXES.map((axis) => radarVertex(axis, entry.normalized[axis]));
}

function radarLabelPlacement(axis: AttentionAxis): {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline?: "hanging";
} {
  const { dx, dy } = RADAR_AXIS_VECTOR[axis];
  const x = RADAR_CENTER + dx * RADAR_LABEL_RADIUS;
  const y = RADAR_CENTER + dy * RADAR_LABEL_RADIUS;
  if (dx === 0) {
    // Top/bottom labels: extend the glyph away from the shape (upward at the
    // default alphabetic baseline, downward via "hanging") rather than
    // straddling the anchor point.
    return { x, y, textAnchor: "middle", dominantBaseline: dy > 0 ? "hanging" : undefined };
  }
  // Left/right labels: anchor so the glyph only extends outward, away from
  // center, so its length never eats into the RADAR_LABEL_GAP clearance.
  return { x, y: y + RADAR_LABEL_BASELINE_NUDGE, textAnchor: dx > 0 ? "start" : "end" };
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
    <div className={`${DASHBOARD_CARD_CLASS} flex flex-col p-5`}>
      <div className={`${DASHBOARD_WIDGET_TITLE_CLASS} mb-1`}>{title}</div>
      <div className={`${WHY_TAG_CLASS} mb-2`}>{whyTag}</div>
      {entries.length === 0 ? (
        <p className={EMPTY_STATE_CLASS}>{emptyMessage}</p>
      ) : (
        <div className="flex flex-1 items-center gap-12">
          <svg
            width={RADAR_VIEWBOX}
            height={RADAR_VIEWBOX}
            viewBox={`0 0 ${RADAR_VIEWBOX} ${RADAR_VIEWBOX}`}
            className="mr-8 flex-shrink-0 overflow-visible"
          >
            {RADAR_RING_RADII.map((radius) => (
              <circle
                key={radius}
                cx={RADAR_CENTER}
                cy={RADAR_CENTER}
                r={radius}
                fill="none"
                stroke={RADAR_GRID_COLOR}
                strokeWidth="1"
              />
            ))}
            {entries.map((entry, index) => {
              const color = RADAR_SERIES_COLORS[index % RADAR_SERIES_COLORS.length]!;
              const vertices = radarPoints(entry);
              const points = vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(" ");
              return (
                <g key={entry.key}>
                  <polygon
                    points={points}
                    fill={`${color}2e`}
                    stroke={color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {vertices.map((vertex, vertexIndex) => (
                    <circle key={RADAR_AXES[vertexIndex]} cx={vertex.x} cy={vertex.y} r="3.5" fill={color} />
                  ))}
                </g>
              );
            })}
            {RADAR_AXES.map((axis) => {
              const placement = radarLabelPlacement(axis);
              return (
                <text
                  key={axis}
                  x={placement.x}
                  y={placement.y}
                  textAnchor={placement.textAnchor}
                  dominantBaseline={placement.dominantBaseline}
                  fontSize="9.5"
                  fill="#8f8f8a"
                >
                  {RADAR_AXIS_LABELS[axis]}
                </text>
              );
            })}
          </svg>
          <div className="flex flex-shrink-0 flex-col gap-2">
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
