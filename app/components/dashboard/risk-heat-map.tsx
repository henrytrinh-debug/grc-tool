"use client";

import Link from "next/link";
import {
  buildRiskHeatMap,
  getHeatMapCellColor,
  getRiskScore,
} from "@/lib/dashboard/analytics";
import { formatImpact, formatLikelihood, RISK_SCALE_VALUES, type Risk } from "@/lib/types/risk";
import { useSettings } from "@/lib/settings/context";

type RiskHeatMapProps = {
  risks: Risk[];
};

export function RiskHeatMap({ risks }: RiskHeatMapProps) {
  useSettings();
  const grid = buildRiskHeatMap(risks);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
        <div />
        {RISK_SCALE_VALUES.map((likelihood) => (
          <div
            key={`likelihood-${likelihood}`}
            className="truncate px-1 text-center text-[10px] font-medium leading-tight text-slate-600 sm:text-xs dark:text-slate-400"
            title={formatLikelihood(likelihood)}
          >
            {formatLikelihood(likelihood)}
          </div>
        ))}

        {[...RISK_SCALE_VALUES].reverse().map((impact) => (
          <div key={`impact-row-${impact}`} className="contents">
            <div className="flex max-w-16 items-center truncate pr-2 text-[10px] font-medium leading-tight text-slate-600 sm:max-w-none sm:text-xs dark:text-slate-400" title={formatImpact(impact)}>
              {formatImpact(impact)}
            </div>
            {RISK_SCALE_VALUES.map((likelihood) => {
              const count = grid[likelihood - 1][impact - 1];
              const score = getRiskScore(likelihood, impact);
              const href = `/risks?likelihood=${likelihood}&impact=${impact}`;

              return (
                <Link
                  key={`${likelihood}-${impact}`}
                  href={href}
                  className={`flex aspect-square min-h-12 items-center justify-center rounded-md border text-sm font-semibold transition-all duration-150 hover:z-10 hover:ring-2 hover:ring-teal-600 hover:ring-offset-1 hover:ring-offset-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:hover:ring-teal-400 dark:hover:ring-offset-slate-900 dark:focus-visible:outline-teal-400 ${
                    count === 0
                      ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      : "border-transparent text-white"
                  }`}
                  style={
                    count > 0
                      ? { backgroundColor: getHeatMapCellColor(score, count) }
                      : undefined
                  }
                  title={`${formatLikelihood(likelihood)} × ${formatImpact(impact)}: ${count} risk${count === 1 ? "" : "s"} — click to filter`}
                >
                  {count}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span>Likelihood →</span>
        <span>Impact ↑</span>
        <span className="ml-auto flex items-center gap-2">
          <span>Low</span>
          <span
            className="h-3 w-16 rounded-full"
            style={{
              background:
                "linear-gradient(to right, hsl(120 65% 42%), hsl(60 65% 42%), hsl(0 65% 42%))",
            }}
          />
          <span>Critical</span>
        </span>
      </div>
    </div>
  );
}
