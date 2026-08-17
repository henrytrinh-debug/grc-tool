import { formatPersonName, type OrgPerson } from "@/lib/types/person";

export type ObligationStatus = "open" | "monitoring" | "retired";

export type ObligationRecord = {
  id: string;
  title: string;
  source: string;
  citation: string;
  requirement_text: string;
  status: ObligationStatus;
  review_frequency_days: number;
  effective_date: string | null;
  review_date: string | null;
  assignee_id?: string | null;
  owner_email?: string;
  owner_id?: string;
  organization_id?: string | null;
  created_at?: string;
};

export type NewObligation = Pick<
  ObligationRecord,
  | "title"
  | "source"
  | "citation"
  | "requirement_text"
  | "status"
  | "review_frequency_days"
  | "effective_date"
  | "review_date"
  | "assignee_id"
>;

export const OBLIGATION_STATUS_OPTIONS: {
  value: ObligationStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "monitoring", label: "Monitoring" },
  { value: "retired", label: "Retired" },
];

export function formatObligationStatus(
  status: ObligationStatus | null | undefined,
) {
  return (
    OBLIGATION_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? "Open"
  );
}

export function isObligationActive(
  obligation: Pick<ObligationRecord, "status">,
) {
  return obligation.status !== "retired";
}

export function obligationCoverage(
  obligations: Pick<ObligationRecord, "id" | "status">[],
  links: Array<{ obligation_id: string }>,
) {
  const covered = new Set(links.map((link) => link.obligation_id));
  const active = obligations.filter(isObligationActive);
  const uncovered = active.filter((obligation) => !covered.has(obligation.id));

  return {
    active: active.length,
    covered: active.length - uncovered.length,
    uncovered: uncovered.length,
  };
}

export function toObligationPayload(form: NewObligation) {
  return {
    title: form.title.trim(),
    source: form.source.trim(),
    citation: form.citation.trim(),
    requirement_text: form.requirement_text.trim(),
    status: form.status,
    review_frequency_days: form.review_frequency_days,
    effective_date: form.effective_date || null,
    review_date: form.review_date || null,
    assignee_id: form.assignee_id || null,
  };
}

export const EMPTY_OBLIGATION_FORM: NewObligation = {
  title: "",
  source: "",
  citation: "",
  requirement_text: "",
  status: "open",
  review_frequency_days: 365,
  effective_date: "",
  review_date: "",
  assignee_id: "",
};

export function formatObligationOwner(
  people: OrgPerson[],
  obligation: Pick<ObligationRecord, "assignee_id" | "owner_email">,
) {
  const named = formatPersonName(people, obligation.assignee_id);
  if (named !== "Unassigned") {
    return named;
  }

  return obligation.owner_email?.trim() || "Unassigned";
}
