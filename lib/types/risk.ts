export type Risk = {
  id: string;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  owner: string;
  created_at?: string;
};

export type NewRisk = Pick<
  Risk,
  "title" | "description" | "likelihood" | "impact" | "owner"
>;
