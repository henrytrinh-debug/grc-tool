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

export function toRiskFormPayload(form: NewRisk) {
  return {
    title: form.title,
    description: form.description,
    likelihood: form.likelihood,
    impact: form.impact,
  };
}
