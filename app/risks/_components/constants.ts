import type { NewRisk } from "@/lib/types/risk";

export const EMPTY_RISK_FORM: NewRisk = {
  title: "",
  description: "",
  likelihood: 3,
  impact: 3,
  residual_likelihood: null,
  residual_impact: null,
  category_id: "",
  treatment: "mitigate",
  assignee_id: "",
  status: "open",
  treatment_rationale: "",
  closure_rationale: "",
  target_date: "",
};
