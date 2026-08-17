"use client";

import { useRouter } from "next/navigation";
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
import {
  barClickDatum,
  chartActiveBar,
  chartHoverCursor,
  chartTooltipStyle,
} from "@/app/components/chart-theme";
import type { ChartCount } from "@/lib/dashboard/analytics";

const COLORS = ["#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"];

type TaxonomyBarChartProps = {
  data: ChartCount[];
  hrefBase?: string;
  queryParam?: string;
};

export function TaxonomyBarChart({
  data,
  hrefBase = "/risks",
  queryParam = "category",
}: TaxonomyBarChartProps) {
  const router = useRouter();
  const chartData = data.filter((item) => item.value > 0);

  if (chartData.length === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-slate-600 dark:text-slate-400">
        No categorised risks to display.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "currentColor", fontSize: 11 }}
          className="text-slate-600 dark:text-slate-400"
          interval={0}
          angle={-20}
          textAnchor="end"
          height={56}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "currentColor", fontSize: 12 }}
          className="text-slate-600 dark:text-slate-400"
        />
        <Tooltip
          cursor={chartHoverCursor}
          contentStyle={chartTooltipStyle}
          formatter={(value) => [value, "Risks"]}
        />
        <Bar
          dataKey="value"
          radius={[6, 6, 0, 0]}
          cursor="pointer"
          activeBar={chartActiveBar}
          onClick={(row) => {
            const filterValue = barClickDatum<{ filterValue?: string }>(row)
              ?.filterValue;
            if (filterValue) {
              router.push(
                `${hrefBase}?${queryParam}=${encodeURIComponent(filterValue)}`,
              );
            }
          }}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.filterValue} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
