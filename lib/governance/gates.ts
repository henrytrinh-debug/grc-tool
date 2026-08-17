import type { NewIncident } from "@/lib/types/incident";
import type { NewRisk } from "@/lib/types/risk";

function blank(value: string | null | undefined) {
  return !value?.trim();
}

/**
 * App-level gates. Empty means the write may proceed.
 * Lessons learned is a prompt, not a hard blocker.
 */
export function riskGovernanceBlockers(
  form: Pick<
    NewRisk,
    "treatment" | "treatment_rationale" | "status" | "closure_rationale"
  >,
  options: {
    operatingReady: boolean;
    hasReviewEvidence: boolean;
  },
): string[] {
  const blockers: string[] = [];
  const treatment = form.treatment ?? "mitigate";
  const status = form.status ?? "open";

  if (
    options.operatingReady &&
    (treatment === "accept" || treatment === "transfer") &&
    blank(form.treatment_rationale)
  ) {
    blockers.push(
      treatment === "accept"
        ? "Accepted risks need a treatment rationale."
        : "Transferred risks need a treatment rationale.",
    );
  }

  if (status === "closed") {
    const hasRationale = !blank(form.closure_rationale);
    if (!hasRationale && !options.hasReviewEvidence) {
      blockers.push(
        "Closing a risk needs a closure rationale or an RCSA review on record.",
      );
    }
  }

  return blockers;
}

export function incidentGovernanceBlockers(
  form: Pick<NewIncident, "status" | "root_cause">,
): string[] {
  if (form.status === "resolved" && blank(form.root_cause)) {
    return ["Resolved incidents need a root cause."];
  }

  return [];
}

export function incidentGovernancePrompts(
  form: Pick<NewIncident, "status" | "lessons_learned">,
  operatingReady: boolean,
): string[] {
  if (
    operatingReady &&
    form.status === "resolved" &&
    blank(form.lessons_learned)
  ) {
    return [
      "Add lessons learned so the same incident is less likely to recur.",
    ];
  }

  return [];
}
