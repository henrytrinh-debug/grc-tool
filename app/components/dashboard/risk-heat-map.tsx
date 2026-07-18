import {
  buildRiskHeatMap,
  getHeatMapCellColor,
  getRiskScore,
} from "@/lib/dashboard/analytics";

type RiskHeatMapProps = {
  risks: Parameters<typeof buildRiskHeatMap>[0];
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
            className="px-1 text-center text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            L{likelihood}
          </div>
        ))}

        {[5, 4, 3, 2, 1].map((impact) => (
          <div key={`impact-row-${impact}`} className="contents">
            <div className="flex items-center pr-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              I{impact}
            </div>
            {[1, 2, 3, 4, 5].map((likelihood) => {
              const count = grid[likelihood - 1][impact - 1];
              const score = getRiskScore(likelihood, impact);

              return (
                <div
                  key={`${likelihood}-${impact}`}
                  className={`flex aspect-square min-h-12 items-center justify-center rounded-md border border-zinc-200 text-sm font-semibold dark:border-zinc-700 ${
                    count === 0
                      ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      : "text-white"
                  }`}
                  style={
                    count > 0
                      ? { backgroundColor: getHeatMapCellColor(score, count) }
                      : undefined
                  }
                  title={`Likelihood ${likelihood}, Impact ${impact}: ${count} risk${count === 1 ? "" : "s"}`}
                >
                  {count}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
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
