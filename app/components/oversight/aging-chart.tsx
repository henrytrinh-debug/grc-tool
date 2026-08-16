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
import { ISSUE_SEVERITY_COLORS, type IssueAgingBucket } from "@/lib/oversight/metrics";
import type { IssueSeverity } from "@/lib/types/issue";

const SEVERITY_ORDER: IssueSeverity[] = ["low", "medium", "high", "critical"];

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

type IssueAgingChartProps = {
  data: IssueAgingBucket[];
};

export function IssueAgingChart({ data }: IssueAgingChartProps) {
  const total = data.reduce((sum, bucket) => sum + bucket.total, 0);

  if (total === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-slate-600 dark:text-slate-400">
        No open issues to display.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <XAxis
          dataKey="bucket"
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-slate-600 dark:text-slate-400"
          label={{ value: "Days open", position: "insideBottom", offset: -2, fontSize: 11 }}
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
          formatter={(value, name) => [value, SEVERITY_LABELS[name as IssueSeverity] ?? name]}
        />
        <Legend formatter={(value) => SEVERITY_LABELS[value as IssueSeverity] ?? value} />
        {SEVERITY_ORDER.map((severity, index) => (
          <Bar
            key={severity}
            dataKey={severity}
            stackId="aging"
            fill={ISSUE_SEVERITY_COLORS[severity]}
            radius={index === SEVERITY_ORDER.length - 1 ? [6, 6, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
