"use client";

import {
  getRiskScore,
  getScoreHeatColor,
  getSeverityBand,
} from "@/lib/dashboard/analytics";
import {
  formatImpact,
  formatLikelihood,
  RISK_SCALE_VALUES,
} from "@/lib/types/risk";
import { SeverityBandBadge } from "@/app/components/status-badge";
import { mutedTextClassName } from "@/app/components/ui";

type RiskScorePickerProps = {
  likelihood: number;
  impact: number;
  onChange: (next: { likelihood: number; impact: number }) => void;
  /** Shown above the grid, e.g. "Confirm or adjust the rating". */
  description?: string;
};

/**
 * 5×5 heat-map picker — the usual GRC alternative to two independent
 * dropdowns, so the reviewer sees the resulting score band while choosing.
 */
export function RiskScorePicker({
  likelihood,
  impact,
  onChange,
  description,
}: RiskScorePickerProps) {
  const score = getRiskScore(likelihood, impact);
  const band = getSeverityBand(score);

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Likelihood × Impact
      </legend>
      {description && (
        <p className={`mt-1 text-sm ${mutedTextClassName}`}>{description}</p>
      )}

      <div className="mt-4 overflow-x-auto">
        <div
          role="grid"
          aria-label="Risk score matrix. Columns are likelihood, rows are impact."
          className="inline-grid grid-cols-[auto_repeat(5,minmax(2.75rem,1fr))] gap-1"
        >
          <div />
          {RISK_SCALE_VALUES.map((value) => (
            <div
              key={`likelihood-head-${value}`}
              className="px-0.5 text-center text-[10px] font-medium leading-tight text-slate-600 sm:text-xs dark:text-slate-400"
            >
              {formatLikelihood(value)}
            </div>
          ))}

          {[...RISK_SCALE_VALUES].reverse().map((impactValue) => (
            <div key={`impact-row-${impactValue}`} className="contents">
              <div className="flex items-center justify-end pr-2 text-[10px] font-medium leading-tight text-slate-600 sm:text-xs dark:text-slate-400">
                {formatImpact(impactValue)}
              </div>
              {RISK_SCALE_VALUES.map((likelihoodValue) => {
                const cellScore = getRiskScore(likelihoodValue, impactValue);
                const selected =
                  likelihoodValue === likelihood && impactValue === impact;

                return (
                  <button
                    key={`${likelihoodValue}-${impactValue}`}
                    type="button"
                    role="gridcell"
                    aria-label={`Likelihood ${likelihoodValue} ${formatLikelihood(likelihoodValue)}, impact ${impactValue} ${formatImpact(impactValue)}, score ${cellScore}`}
                    aria-selected={selected}
                    onClick={() =>
                      onChange({
                        likelihood: likelihoodValue,
                        impact: impactValue,
                      })
                    }
                    className={`flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-md text-xs font-semibold text-white transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:focus-visible:outline-teal-400 ${
                      selected
                        ? "ring-2 ring-slate-950 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900"
                        : "hover:opacity-90"
                    }`}
                    style={{ backgroundColor: getScoreHeatColor(cellScore) }}
                  >
                    {cellScore}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <span>
          {formatLikelihood(likelihood)} × {formatImpact(impact)}
        </span>
        <span className="text-slate-400">·</span>
        <span>Score {score}</span>
        <SeverityBandBadge band={band} />
      </p>
    </fieldset>
  );
}
