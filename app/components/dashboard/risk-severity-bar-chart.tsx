"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeverityBandCount } from "@/lib/dashboard/analytics";

const BAND_COLORS: Record<SeverityBandCount["band"], string> = {
  Low: "#22c55e",
  Medium: "#eab308",
  High: "#f97316",
  Critical: "#ef4444",
};

type RiskSeverityBarChartProps = {
  data: SeverityBandCount[];
};

export function RiskSeverityBarChart({ data }: RiskSeverityBarChartProps) {
  const chartData = data.map((item) => ({
    band: item.band,
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
        <XAxis
          dataKey="band"
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-zinc-600 dark:text-zinc-400"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-zinc-600 dark:text-zinc-400"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgb(24 24 27)",
            border: "1px solid rgb(39 39 42)",
            borderRadius: "0.5rem",
            color: "rgb(250 250 250)",
          }}
          formatter={(value) => [value, "Risks"]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.band} fill={BAND_COLORS[entry.band]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
