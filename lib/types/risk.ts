import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { getSettings } from "@/lib/settings/store";

export type RiskTreatment = "mitigate" | "accept" | "transfer" | "avoid";

export type RiskStatus = "open" | "monitoring" | "closed";

export type Risk = {
  id: string;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  category_id?: string | null;
  treatment?: RiskTreatment;
  assignee_id?: string | null;
  status?: RiskStatus;
  treatment_rationale?: string;
  closure_rationale?: string;
  target_date?: string | null;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewRisk = Pick<
  Risk,
  | "title"
  | "description"
  | "likelihood"
  | "impact"
  | "category_id"
  | "treatment"
  | "assignee_id"
  | "status"
  | "treatment_rationale"
  | "closure_rationale"
  | "target_date"
>;

export const RISK_SCALE_VALUES = [1, 2, 3, 4, 5] as const;

export type RiskScaleValue = (typeof RISK_SCALE_VALUES)[number];

/** ISO 31000-style qualitative labels for the 1–5 likelihood scale. */
export const LIKELIHOOD_LABELS = DEFAULT_SETTINGS.likelihoodLabels;

/** ISO 31000-style qualitative labels for the 1–5 impact scale. */
export const IMPACT_LABELS = DEFAULT_SETTINGS.impactLabels;

export const RISK_STATUS_OPTIONS: { value: RiskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "monitoring", label: "Monitoring" },
  { value: "closed", label: "Closed" },
];

export function formatRiskStatus(status: RiskStatus | null | undefined) {
  return (
    RISK_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Open"
  );
}

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
  options: {
    includeTaxonomy?: boolean;
    includeEnterprise?: boolean;
    includeOperating?: boolean;
    includeGovernance?: boolean;
  } = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: form.title,
    description: form.description,
    likelihood: form.likelihood,
    impact: form.impact,
  };

  if (options.includeTaxonomy) {
    payload.category_id = form.category_id || null;
    payload.treatment = form.treatment ?? "mitigate";
  }

  if (options.includeEnterprise) {
    payload.assignee_id = form.assignee_id || null;
    payload.status = form.status ?? "open";
  }

  if (options.includeOperating) {
    payload.treatment_rationale = form.treatment_rationale ?? "";
    payload.target_date = form.target_date || null;
  }

  if (options.includeGovernance) {
    payload.closure_rationale = form.closure_rationale ?? "";
  }

  return payload;
}
