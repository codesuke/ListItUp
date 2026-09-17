// Shared by List Dashboard (app/workspaces/.../DashboardTab.tsx) and My
// Tasks Dashboard (app/my-tasks/page.tsx, #52) so the count-tile/breakdown
// card look stays identical across both without copy-adapting ~80 lines.
export const DASHBOARD_CARD_CLASS = "rounded-[12px] border border-line bg-surface-2";
export const DASHBOARD_WIDGET_TITLE_CLASS =
  "font-[family-name:var(--font-mono-label)] text-[11px] uppercase tracking-[0.1em] text-ink-faint";
const EMPTY_STATE_CLASS = "text-sm text-ink-faint";

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
