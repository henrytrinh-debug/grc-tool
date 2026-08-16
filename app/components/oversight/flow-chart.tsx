"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FlowCounts } from "@/lib/oversight/metrics";

type FlowDatum = FlowCounts & { period: string };

type FlowBarChartProps = {
  last30: FlowCounts;
  last90: FlowCounts;
  openedLabel: string;
  closedLabel: string;
  emptyMessage: string;
};

/** Grouped bar chart comparing opened/new vs closed/resolved counts across
 * the trailing 30 and 90 day windows. Shared by the issues and incidents
 * flow sections since both boil down to the same shape. */
export function FlowBarChart({
  last30,
  last90,
  openedLabel,
  closedLabel,
  emptyMessage,
}: FlowBarChartProps) {
  const data: FlowDatum[] = [
    { period: "Last 30 days", ...last30 },
    { period: "Last 90 days", ...last90 },
  ];

  const total = data.reduce((sum, row) => sum + row.opened + row.closed, 0);

  if (total === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-slate-600 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <XAxis
          dataKey="period"
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgb(15 23 42)",
            border: "1px solid rgb(51 65 85)",
            borderRadius: "0.5rem",
            color: "rgb(248 250 252)",
          }}
        />
        <Legend />
        <Bar dataKey="opened" name={openedLabel} fill="#f97316" radius={[6, 6, 0, 0]} />
        <Bar dataKey="closed" name={closedLabel} fill="#22c55e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
