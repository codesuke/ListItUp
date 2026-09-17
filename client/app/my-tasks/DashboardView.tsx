import { BreakdownWidget, CountTile } from "@/components/workspace/DashboardWidgets";
import type { MyTasksDashboardData } from "./page-data";

const STATE_BAR_COLOR: Record<MyTasksDashboardData["byState"][number]["state"], string> = {
  TO_DO: "bg-ink-faint",
  IN_PROGRESS: "bg-[#5b9dff]",
  BLOCKED: "bg-[#f5b642]",
  COMPLETE: "bg-[#3ecf8e]",
  ARCHIVED: "bg-[#525252]",
};

// A trimmed personal Dashboard (design-mocks/my-tasks-dashboard, #52) —
// counts and breakdowns only, scoped to Items assigned to the User across
// every Workspace and their Personal Space. No heatmap/donut/contribution/
// peer-comparison: those are List Dashboard-specific (#51/#54-58).
export function DashboardView({ counts, byState, byWorkspace }: MyTasksDashboardData) {
  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <CountTile label="Total Assigned" value={counts.total} />
        <CountTile label="Completed" value={counts.completed} valueColor="#3ecf8e" />
        <CountTile label="Incomplete" value={counts.incomplete} />
        <CountTile label="Overdue" value={counts.overdue} valueColor="#f2545b" />
      </div>

      <div className="grid grid-cols-2 gap-5">
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
          title="Breakdown by Workspace"
          total={counts.total}
          entries={byWorkspace.map((entry) => ({
            label: entry.label,
            count: entry.count,
            barColorClassName: "bg-[#ff6b4a]",
          }))}
        />
      </div>

      <p className="text-[11.5px] text-ink-faint">
        A trimmed personal Dashboard — counts and breakdowns only, scoped to Items assigned to you across every
        Workspace and your Personal Space.
      </p>
    </div>
  );
}
