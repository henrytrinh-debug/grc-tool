export type GovernanceEventType =
  | "status"
  | "treatment"
  | "assignment"
  | "rating";

export type GovernanceEvent = {
  id: string;
  event_type: GovernanceEventType;
  field: string;
  previous_value: string;
  next_value: string;
  actor_id?: string;
  actor_email?: string | null;
  owner_id?: string;
  owner_email?: string | null;
  organization_id?: string | null;
  created_at: string;
};

export type RiskEvent = GovernanceEvent & {
  risk_id: string;
};

export type IncidentEvent = GovernanceEvent & {
  incident_id: string;
};

export type GovernanceEventDraft = {
  event_type: GovernanceEventType;
  field: string;
  previous_value: string;
  next_value: string;
};

function changed(previous: string, next: string) {
  return previous !== next;
}

export function riskEventDrafts(input: {
  previousStatus?: string | null;
  nextStatus?: string | null;
  previousTreatment?: string | null;
  nextTreatment?: string | null;
  previousAssigneeId?: string | null;
  nextAssigneeId?: string | null;
  previousLikelihood: number;
  nextLikelihood: number;
  previousImpact: number;
  nextImpact: number;
}): GovernanceEventDraft[] {
  const drafts: GovernanceEventDraft[] = [];
  const previousStatus = input.previousStatus ?? "open";
  const nextStatus = input.nextStatus ?? "open";
  const previousTreatment = input.previousTreatment ?? "mitigate";
  const nextTreatment = input.nextTreatment ?? "mitigate";
  const previousAssignee = input.previousAssigneeId ?? "";
  const nextAssignee = input.nextAssigneeId ?? "";

  if (changed(previousStatus, nextStatus)) {
    drafts.push({
      event_type: "status",
      field: "status",
      previous_value: previousStatus,
      next_value: nextStatus,
    });
  }

  if (changed(previousTreatment, nextTreatment)) {
    drafts.push({
      event_type: "treatment",
      field: "treatment",
      previous_value: previousTreatment,
      next_value: nextTreatment,
    });
  }

  if (changed(previousAssignee, nextAssignee)) {
    drafts.push({
      event_type: "assignment",
      field: "assignee_id",
      previous_value: previousAssignee,
      next_value: nextAssignee,
    });
  }

  if (
    input.previousLikelihood !== input.nextLikelihood ||
    input.previousImpact !== input.nextImpact
  ) {
    drafts.push({
      event_type: "rating",
      field: "likelihood_impact",
      previous_value: `${input.previousLikelihood}×${input.previousImpact}`,
      next_value: `${input.nextLikelihood}×${input.nextImpact}`,
    });
  }

  return drafts;
}

export function incidentEventDrafts(input: {
  previousStatus: string;
  nextStatus: string;
  previousAssigneeId?: string | null;
  nextAssigneeId?: string | null;
  previousSeverity: string;
  nextSeverity: string;
}): GovernanceEventDraft[] {
  const drafts: GovernanceEventDraft[] = [];
  const previousAssignee = input.previousAssigneeId ?? "";
  const nextAssignee = input.nextAssigneeId ?? "";

  if (changed(input.previousStatus, input.nextStatus)) {
    drafts.push({
      event_type: "status",
      field: "status",
      previous_value: input.previousStatus,
      next_value: input.nextStatus,
    });
  }

  if (changed(previousAssignee, nextAssignee)) {
    drafts.push({
      event_type: "assignment",
      field: "assignee_id",
      previous_value: previousAssignee,
      next_value: nextAssignee,
    });
  }

  if (changed(input.previousSeverity, input.nextSeverity)) {
    drafts.push({
      event_type: "rating",
      field: "severity",
      previous_value: input.previousSeverity,
      next_value: input.nextSeverity,
    });
  }

  return drafts;
}
