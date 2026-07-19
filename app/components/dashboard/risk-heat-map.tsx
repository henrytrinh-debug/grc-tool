"use client";

import Link from "next/link";
import {
  buildRiskHeatMap,
  getHeatMapCellColor,
  getRiskScore,
} from "@/lib/dashboard/analytics";
import type { Risk } from "@/lib/types/risk";

type RiskHeatMapProps = {
  risks: Risk[];
};

export function RiskHeatMap({ risks }: RiskHeatMapProps) {
  const grid = buildRiskHeatMap(risks);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
        <div />
        {[1, 2, 3, 4, 5].map((likelihood) => (
          <div
            key={`likelihood-${likelihood}`}
            className="px-1 text-center text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            L{likelihood}
          </div>
        ))}

        {[5, 4, 3, 2, 1].map((impact) => (
          <div key={`impact-row-${impact}`} className="contents">
            <div className="flex items-center pr-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              I{impact}
            </div>
            {[1, 2, 3, 4, 5].map((likelihood) => {
              const count = grid[likelihood - 1][impact - 1];
              const score = getRiskScore(likelihood, impact);
              const href = `/risks?likelihood=${likelihood}&impact=${impact}`;

              return (
                <Link
                  key={`${likelihood}-${impact}`}
                  href={href}
                  className={`flex aspect-square min-h-12 items-center justify-center rounded-md border text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:focus-visible:outline-teal-400 ${
                    count === 0
                      ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      : "border-transparent text-white"
                  }`}
                  style={
                    count > 0
                      ? { backgroundColor: getHeatMapCellColor(score, count) }
                      : undefined
                  }
                  title={`Likelihood ${likelihood}, Impact ${impact}: ${count} risk${count === 1 ? "" : "s"} — click to filter`}
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
