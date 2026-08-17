import { SeverityBandBadge } from "@/app/components/status-badge";
import type { SeverityBand } from "@/lib/dashboard/analytics";
import {
  formatImpactOption,
  formatLikelihoodOption,
} from "@/lib/types/risk";

type RiskScoreCellProps = {
  likelihood?: number;
  impact?: number;
  score?: number;
  band?: SeverityBand;
  empty?: boolean;
};

export function RiskScoreCell({
  likelihood,
  impact,
  score,
  band,
  empty,
}: RiskScoreCellProps) {
  if (empty || likelihood == null || impact == null || score == null || !band) {
    return <span className="text-slate-500 dark:text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums font-medium text-slate-950 dark:text-slate-50">
          {score}
        </span>
        <SeverityBandBadge band={band} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {formatLikelihoodOption(likelihood)} × {formatImpactOption(impact)}
      </span>
    </div>
  );
}
