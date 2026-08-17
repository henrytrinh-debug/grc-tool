"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartActiveBar,
  chartHoverCursor,
  chartTooltipStyle,
} from "@/app/components/chart-theme";

const SERIES_COLORS = [
  "#0f766e",
  "#f97316",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#22c55e",
];

type TimeSeriesRow = {
  label: string;
  [key: string]: string | number;
};

export function StackedTimeChart({
  data,
  series,
  empty,
}: {
  data: TimeSeriesRow[];
  series: Array<{ key: string; label: string }>;
  empty: string;
}) {
  const total = data.reduce((sum, row) => {
    return (
      sum +
      series.reduce((inner, item) => inner + Number(row[item.key] ?? 0), 0)
    );
  }, 0);

  if (total === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-slate-600 dark:text-slate-400">
        {empty}
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
          dataKey="label"
          tick={{ fill: "currentColor", fontSize: 11 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <Tooltip cursor={chartHoverCursor} contentStyle={chartTooltipStyle} />
        <Legend />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId="stack"
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            activeBar={chartActiveBar}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineTimeChart({
  data,
  series,
  empty,
}: {
  data: TimeSeriesRow[];
  series: Array<{ key: string; label: string }>;
  empty: string;
}) {
  const total = data.reduce((sum, row) => {
    return (
      sum +
      series.reduce((inner, item) => inner + Number(row[item.key] ?? 0), 0)
    );
  }, 0);

  if (total === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-slate-600 dark:text-slate-400">
        {empty}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "currentColor", fontSize: 11 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <Tooltip cursor={chartHoverCursor} contentStyle={chartTooltipStyle} />
        <Legend />
        {series.map((item, index) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
