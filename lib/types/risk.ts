import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { getSettings } from "@/lib/settings/store";

export type RiskTreatment = "mitigate" | "accept" | "transfer" | "avoid";

export type Risk = {
  id: string;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  category_id?: string | null;
  treatment?: RiskTreatment;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewRisk = Pick<
  Risk,
  "title" | "description" | "likelihood" | "impact" | "category_id" | "treatment"
>;

export const RISK_SCALE_VALUES = [1, 2, 3, 4, 5] as const;

export type RiskScaleValue = (typeof RISK_SCALE_VALUES)[number];

/** ISO 31000-style qualitative labels for the 1–5 likelihood scale. */
export const LIKELIHOOD_LABELS = DEFAULT_SETTINGS.likelihoodLabels;

/** ISO 31000-style qualitative labels for the 1–5 impact scale. */
export const IMPACT_LABELS = DEFAULT_SETTINGS.impactLabels;

export const RISK_TREATMENT_OPTIONS: {
  value: RiskTreatment;
  label: string;
}[] = [
  { value: "mitigate", label: "Mitigate" },
  { value: "accept", label: "Accept" },
  { value: "transfer", label: "Transfer" },
  { value: "avoid", label: "Avoid" },
];

export function formatTreatment(treatment: RiskTreatment | null | undefined) {
  return (
    RISK_TREATMENT_OPTIONS.find((option) => option.value === treatment)?.label ??
    "Mitigate"
  );
}

export function isRiskScaleValue(value: number): value is RiskScaleValue {
  return RISK_SCALE_VALUES.includes(value as RiskScaleValue);
}

export function formatLikelihood(value: number) {
  const labels = getSettings().likelihoodLabels;
  return isRiskScaleValue(value) ? labels[value] : String(value);
}

export function formatImpact(value: number) {
  const labels = getSettings().impactLabels;
  return isRiskScaleValue(value) ? labels[value] : String(value);
}

export function formatLikelihoodOption(value: number) {
  return `${value} · ${formatLikelihood(value)}`;
}

export function formatImpactOption(value: number) {
  return `${value} · ${formatImpact(value)}`;
}

export function toRiskFormPayload(
  form: NewRisk,
  includeTaxonomy = false,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: form.title,
    description: form.description,
    likelihood: form.likelihood,
    impact: form.impact,
  };

  if (includeTaxonomy) {
    payload.category_id = form.category_id || null;
    payload.treatment = form.treatment ?? "mitigate";
  }

  return payload;
}
