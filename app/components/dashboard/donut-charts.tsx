"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ChartCount } from "@/lib/dashboard/analytics";

const EFFECTIVENESS_COLORS: Record<string, string> = {
  Effective: "#22c55e",
  Ineffective: "#ef4444",
  "Not Tested": "#a1a1aa",
};

type DonutChartProps = {
  data: ChartCount[];
  colors?: Record<string, string>;
  emptyMessage: string;
};

function DashboardDonutChart({
  data,
  colors,
  emptyMessage,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
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
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={colors?.[entry.name] ?? "#71717a"}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "rgb(24 24 27)",
            border: "1px solid rgb(39 39 42)",
            borderRadius: "0.5rem",
            color: "rgb(250 250 250)",
          }}
        />
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
  return (
    <DashboardDonutChart
      data={data}
      colors={EFFECTIVENESS_COLORS}
      emptyMessage="No controls to display."
    />
  );
}

const STATUS_COLORS: Record<string, string> = {
  Open: "#f97316",
  Investigating: "#3b82f6",
  Resolved: "#22c55e",
};

type IncidentsStatusDonutProps = {
  data: ChartCount[];
};

export function IncidentsStatusDonut({ data }: IncidentsStatusDonutProps) {
  return (
    <DashboardDonutChart
      data={data}
      colors={STATUS_COLORS}
      emptyMessage="No incidents to display."
    />
  );
}
