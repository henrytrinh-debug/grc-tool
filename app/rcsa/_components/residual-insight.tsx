import { SeverityBandBadge } from "@/app/components/status-badge";
import { mutedTextClassName } from "@/app/components/ui";
import type { IndicativeResidual } from "@/lib/rcsa/review-insight";
import { formatImpact, formatLikelihood } from "@/lib/types/risk";

type ResidualInsightProps = {
  residual: IndicativeResidual;
};

export function ResidualInsight({ residual }: ResidualInsightProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Inherent
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-950 dark:text-slate-50">
            Score {residual.inherentScore}
            <SeverityBandBadge band={residual.inherentBand} />
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Indicative residual
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-950 dark:text-slate-50">
            {formatLikelihood(residual.residualLikelihood)} ×{" "}
            {formatImpact(residual.residualImpact)} · score{" "}
            {residual.residualScore}
            <SeverityBandBadge band={residual.residualBand} />
          </p>
        </div>
      </div>
      <p className={`mt-3 text-sm ${mutedTextClassName}`}>{residual.rationale}</p>
      <p className={`mt-1 text-xs ${mutedTextClassName}`}>
        Confirm residual separately — it is not written until you submit this review.
      </p>
    </div>
  );
}
