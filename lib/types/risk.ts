export type Risk = {
  id: string;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewRisk = Pick<
  Risk,
  "title" | "description" | "likelihood" | "impact"
>;

export const RISK_SCALE_VALUES = [1, 2, 3, 4, 5] as const;

export type RiskScaleValue = (typeof RISK_SCALE_VALUES)[number];

/** ISO 31000-style qualitative labels for the 1–5 likelihood scale. */
export const LIKELIHOOD_LABELS: Record<RiskScaleValue, string> = {
  1: "Rare",
  2: "Unlikely",
  3: "Possible",
  4: "Likely",
  5: "Almost certain",
};

/** ISO 31000-style qualitative labels for the 1–5 impact scale. */
export const IMPACT_LABELS: Record<RiskScaleValue, string> = {
  1: "Negligible",
  2: "Minor",
  3: "Moderate",
  4: "Major",
  5: "Severe",
};

export function isRiskScaleValue(value: number): value is RiskScaleValue {
  return RISK_SCALE_VALUES.includes(value as RiskScaleValue);
}

export function formatLikelihood(value: number) {
  return isRiskScaleValue(value) ? LIKELIHOOD_LABELS[value] : String(value);
}

export function formatImpact(value: number) {
  return isRiskScaleValue(value) ? IMPACT_LABELS[value] : String(value);
}

export function formatLikelihoodOption(value: number) {
  return `${value} · ${formatLikelihood(value)}`;
}

export function formatImpactOption(value: number) {
  return `${value} · ${formatImpact(value)}`;
}

export function toRiskFormPayload(form: NewRisk) {
  return {
    title: form.title,
    description: form.description,
    likelihood: form.likelihood,
    impact: form.impact,
  };
}
