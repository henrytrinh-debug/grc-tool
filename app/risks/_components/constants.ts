import type { NewRisk } from "@/lib/types/risk";

export const EMPTY_RISK_FORM: NewRisk = {
  title: "",
  description: "",
  likelihood: 3,
  impact: 3,
};
