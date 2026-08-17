import { addDaysToIsoDate, todayIsoDate } from "@/lib/dates";

export type FollowUpEntityType =
  | "risk"
  | "control"
  | "incident"
  | "issue"
  | "obligation";

export type FollowUpTrigger =
  | "incident_on_control"
  | "issue_on_control"
  | "ineffective_test"
  | "incident_on_risk"
  | "issue_on_risk"
  | "rating_changed";

export type FollowUpStatus =
  | "open"
  | "in_progress"
  | "pending_approval"
  | "done"
  | "dismissed";

export type FollowUp = {
  id: string;
  title: string;
  description: string;
  entity_type: FollowUpEntityType;
  entity_id: string;
  trigger_type: FollowUpTrigger;
  status: FollowUpStatus;
  assignee_id?: string | null;
  approver_id?: string | null;
  due_date?: string | null;
  source_incident_id?: string | null;
  source_issue_id?: string | null;
  completed_at?: string | null;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export const FOLLOW_UP_STATUS_OPTIONS: {
  value: FollowUpStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismissed" },
];

export const FOLLOW_UP_TRIGGER_OPTIONS: {
  value: FollowUpTrigger;
  label: string;
}[] = [
  { value: "incident_on_control", label: "Incident on control" },
  { value: "issue_on_control", label: "Issue on control" },
  { value: "ineffective_test", label: "Ineffective test" },
  { value: "incident_on_risk", label: "Incident on risk" },
  { value: "issue_on_risk", label: "Issue on risk" },
  { value: "rating_changed", label: "Rating change" },
];

export function formatFollowUpStatus(status: FollowUpStatus) {
  return (
    FOLLOW_UP_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export function formatFollowUpTrigger(trigger: FollowUpTrigger) {
  return (
    FOLLOW_UP_TRIGGER_OPTIONS.find((option) => option.value === trigger)
      ?.label ?? trigger
  );
}

export const OPEN_FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  "open",
  "in_progress",
  "pending_approval",
];

export function isFollowUpOpen(status: FollowUpStatus) {
  return OPEN_FOLLOW_UP_STATUSES.includes(status);
}

export function followUpStatusPatch(status: FollowUpStatus) {
  const closed = status === "done" || status === "dismissed";
  return {
    status,
    completed_at: closed ? new Date().toISOString() : null,
  };
}

export function defaultFollowUpDueDate(days = 14) {
  return addDaysToIsoDate(todayIsoDate(), days);
}

export function followUpHref(followUp: Pick<FollowUp, "id">) {
  return `/feedback?focus=${followUp.id}`;
}

export function entityHref(
  entityType: FollowUpEntityType | "follow_up",
  entityId: string,
) {
  if (entityType === "follow_up") {
    return `/feedback?focus=${entityId}`;
  }
  const path =
    entityType === "risk"
      ? "risks"
      : entityType === "control"
        ? "controls"
        : entityType === "incident"
          ? "incidents"
          : entityType === "issue"
            ? "issues"
            : "obligations";
  return `/${path}/${entityId}/edit`;
}
