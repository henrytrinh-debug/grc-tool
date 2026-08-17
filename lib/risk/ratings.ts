import {
  getRiskScore,
  getSeverityBand,
  type SeverityBand,
} from "@/lib/dashboard/analytics";
import type { IndicativeResidual } from "@/lib/rcsa/review-insight";
import { isRiskScaleValue, type Risk } from "@/lib/types/risk";

export type RatingPair = {
  likelihood: number;
  impact: number;
};

export type RiskRatingFields = Pick<
  Risk,
  "likelihood" | "impact" | "residual_likelihood" | "residual_impact"
>;

export function inherentRating(
  risk: Pick<RiskRatingFields, "likelihood" | "impact">,
): RatingPair {
  return { likelihood: risk.likelihood, impact: risk.impact };
}

export function storedResidual(
  risk: Pick<RiskRatingFields, "residual_likelihood" | "residual_impact">,
): RatingPair | null {
  if (
    typeof risk.residual_likelihood === "number" &&
    typeof risk.residual_impact === "number"
  ) {
    return {
      likelihood: risk.residual_likelihood,
      impact: risk.residual_impact,
    };
  }

  return null;
}

/**
 * Residual if assessed, otherwise inherent. COSO/ISO compare residual to
 * appetite; until residual is confirmed, inherent is the conservative stand-in.
 */
export function operatingRating(risk: RiskRatingFields): RatingPair {
  return storedResidual(risk) ?? inherentRating(risk);
}

export function inherentScore(risk: Pick<RiskRatingFields, "likelihood" | "impact">) {
  return getRiskScore(risk.likelihood, risk.impact);
}

export function operatingScore(risk: RiskRatingFields) {
  const rating = operatingRating(risk);
  return getRiskScore(rating.likelihood, rating.impact);
}

export function operatingBand(risk: RiskRatingFields): SeverityBand {
  return getSeverityBand(operatingScore(risk));
}

export function inherentBand(
  risk: Pick<RiskRatingFields, "likelihood" | "impact">,
): SeverityBand {
  return getSeverityBand(inherentScore(risk));
}

export function residualPayload(
  residual: Partial<Pick<Risk, "residual_likelihood" | "residual_impact">>,
): { residual_likelihood: number | null; residual_impact: number | null } {
  const likelihood = residual.residual_likelihood;
  const impact = residual.residual_impact;
  if (typeof likelihood === "number" && typeof impact === "number") {
    return { residual_likelihood: likelihood, residual_impact: impact };
  }

  return { residual_likelihood: null, residual_impact: null };
}

export function clampResidualToInherent(
  inherent: RatingPair,
  residual: RatingPair,
): RatingPair {
  return {
    likelihood: Math.min(residual.likelihood, inherent.likelihood),
    impact: Math.min(residual.impact, inherent.impact),
  };
}

export function residualCellAllowed(
  inherent: RatingPair,
  likelihood: number,
  impact: number,
) {
  return likelihood <= inherent.likelihood && impact <= inherent.impact;
}

/**
 * Hard gates: residual must sit on the 1–5 scale and cannot exceed inherent.
 * Claiming a reduction with no linked controls is also blocked.
 */
export function residualBlockers(
  inherent: RatingPair,
  residual: RatingPair | null,
  options: { controlCount: number; required?: boolean } = { controlCount: 0 },
): string[] {
  if (!residual) {
    if (options.required) {
      return ["Confirm residual likelihood and impact after reviewing controls."];
    }
    return [];
  }

  const blockers: string[] = [];

  if (!isRiskScaleValue(residual.likelihood) || !isRiskScaleValue(residual.impact)) {
    blockers.push("Residual likelihood and impact must each be between 1 and 5.");
  }

  if (residual.likelihood > inherent.likelihood) {
    blockers.push(
      "Residual likelihood cannot be higher than inherent likelihood.",
    );
  }

  if (residual.impact > inherent.impact) {
    blockers.push("Residual impact cannot be higher than inherent impact.");
  }

  const reduced =
    residual.likelihood < inherent.likelihood ||
    residual.impact < inherent.impact;

  if (reduced && options.controlCount === 0) {
    blockers.push(
      "Residual cannot sit below inherent with no linked controls. Link a control or keep residual equal to inherent.",
    );
  }

  return blockers;
}

export function residualWarnings(
  inherent: RatingPair,
  residual: RatingPair,
  indicative: IndicativeResidual,
  options: {
    controlCount: number;
    openHighIncidents?: number;
    openHighIssues?: number;
  },
): string[] {
  const warnings: string[] = [];
  const residualScore = getRiskScore(residual.likelihood, residual.impact);

  if (
    residual.likelihood < indicative.residualLikelihood ||
    residual.impact < indicative.residualImpact
  ) {
    warnings.push(
      "Confirmed residual is more optimistic than control evidence (indicative residual). Record why, or raise an issue if the evidence is incomplete.",
    );
  }

  if (
    indicative.reduced &&
    residualScore === inherentScore(inherent) &&
    options.controlCount > 0
  ) {
    warnings.push(
      "All relevant controls are effective, but residual still equals inherent. Confirm that no likelihood credit is warranted.",
    );
  }

  if ((options.openHighIncidents ?? 0) > 0 && residualScore < inherentScore(inherent)) {
    warnings.push(
      "High or critical incidents are still open against this risk. Residual reduction should be challenged.",
    );
  }

  if ((options.openHighIssues ?? 0) > 0 && residualScore < inherentScore(inherent)) {
    warnings.push(
      "High or critical issues are still open against this risk. Residual reduction should be challenged.",
    );
  }

  return warnings;
}
