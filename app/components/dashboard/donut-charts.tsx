"use client";

import { useRouter } from "next/navigation";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { chartTooltipStyle } from "@/app/components/chart-theme";
import type { ChartCount } from "@/lib/dashboard/analytics";

const EFFECTIVENESS_COLORS: Record<string, string> = {
  Effective: "#22c55e",
  Ineffective: "#ef4444",
  "Not Tested": "#94a3b8",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "#f97316",
  Investigating: "#3b82f6",
  Resolved: "#22c55e",
};

const ISSUE_STATUS_COLORS: Record<string, string> = {
  Open: "#f97316",
  "In Progress": "#3b82f6",
  "Pending Review": "#8b5cf6",
  Closed: "#22c55e",
};

type DonutChartProps = {
  data: ChartCount[];
  colors?: Record<string, string>;
  emptyMessage: string;
  onSliceClick: (filterValue: string) => void;
};

/** Generic donut chart shared across dashboard-style pages — exported so
 * other analytics views (e.g. Oversight Monitoring) can reuse it with their
 * own colors and click targets rather than duplicating the chart markup. */
export function DashboardDonutChart({
  data,
  colors,
  emptyMessage,
  onSliceClick,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-slate-600 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          cursor="pointer"
          stroke="transparent"
          strokeWidth={1}
          onClick={(_, index) => {
            const entry = data[index];
            if (entry) {
              onSliceClick(entry.filterValue);
            }
          }}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={colors?.[entry.name] ?? "#64748b"}
            />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

type ControlsEffectivenessDonutProps = {
  data: ChartCount[];
};

export function ControlsEffectivenessDonut({
  data,
}: ControlsEffectivenessDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={EFFECTIVENESS_COLORS}
      emptyMessage="No controls to display."
      onSliceClick={(filterValue) =>
        router.push(`/controls?effectiveness=${filterValue}`)
      }
    />
  );
}

type IncidentsStatusDonutProps = {
  data: ChartCount[];
};

export function IncidentsStatusDonut({ data }: IncidentsStatusDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={STATUS_COLORS}
      emptyMessage="No incidents to display."
      onSliceClick={(filterValue) =>
        router.push(`/incidents?status=${filterValue}`)
      }
    />
  );
}

type IssuesStatusDonutProps = {
  data: ChartCount[];
};

export function IssuesStatusDonut({ data }: IssuesStatusDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={ISSUE_STATUS_COLORS}
      emptyMessage="No issues to display."
      onSliceClick={(filterValue) =>
        router.push(`/issues?status=${filterValue}`)
      }
    />
  );
}
