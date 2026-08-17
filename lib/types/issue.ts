import { getSettings } from "@/lib/settings/store";
import { addDaysToIsoDate, formatIsoDate, todayIsoDate } from "@/lib/dates";

export type IssueSource =
  | "internal_audit"
  | "external_audit"
  | "regulatory_exam"
  | "control_failure"
  | "incident"
  | "risk_assessment"
  | "self_identified";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export type IssueStatus = "open" | "in_progress" | "pending_review" | "closed";

export type Issue = {
  id: string;
  title: string;
  description: string;
  source: IssueSource;
  severity: IssueSeverity;
  status: IssueStatus;
  identified_at: string;
  due_date: string | null;
  root_cause: string;
  remediation_plan: string;
  closure_notes: string;
  closed_at: string | null;
  assignee_id?: string | null;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewIssue = Pick<
  Issue,
  | "title"
  | "description"
  | "source"
  | "severity"
  | "status"
  | "identified_at"
  | "due_date"
  | "root_cause"
  | "remediation_plan"
  | "closure_notes"
  | "assignee_id"
>;

export const ISSUE_SOURCE_OPTIONS: { value: IssueSource; label: string }[] = [
  { value: "internal_audit", label: "Internal Audit" },
  { value: "external_audit", label: "External Audit" },
  { value: "regulatory_exam", label: "Regulatory Exam" },
  { value: "control_failure", label: "Control Failure" },
  { value: "incident", label: "Incident" },
  { value: "risk_assessment", label: "Risk Assessment" },
  { value: "self_identified", label: "Self Identified" },
];

export const ISSUE_SEVERITY_OPTIONS: {
  value: IssueSeverity;
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const ISSUE_STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_review", label: "Pending Review" },
  { value: "closed", label: "Closed" },
];

/**
 * Target-date defaults by severity, applied when raising an issue. Critical
 * findings get the tightest remediation window. Override in Admin.
 */
export function formatIssueSource(source: IssueSource) {
  return (
    ISSUE_SOURCE_OPTIONS.find((option) => option.value === source)?.label ??
    source
  );
}

export function formatIssueSeverity(severity: IssueSeverity) {
  return (
    ISSUE_SEVERITY_OPTIONS.find((option) => option.value === severity)?.label ??
    severity
  );
}

export function formatIssueStatus(status: IssueStatus) {
  return (
    ISSUE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export { addDaysToIsoDate, todayIsoDate };

export function getDefaultDueDate(severity: IssueSeverity) {
  return addDaysToIsoDate(
    todayIsoDate(),
    getSettings().issueDueDays[severity],
  );
}

export function formatIssueDate(value: string | null | undefined) {
  return formatIsoDate(value);
}

export function isIssueOpen(status: IssueStatus) {
  return status !== "closed";
}

export function isIssueOverdue(issue: Pick<Issue, "due_date" | "status">) {
  if (!issue.due_date || !isIssueOpen(issue.status)) {
    return false;
  }

  return issue.due_date < todayIsoDate();
}

/**
 * Negative when the target date has passed.
 */
export function getDaysUntilDue(dueDate: string | null | undefined) {
  if (!dueDate) {
    return null;
  }

  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const today = new Date(`${todayIsoDate()}T00:00:00`).getTime();

  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

export function formatDueDateLabel(issue: Pick<Issue, "due_date" | "status">) {
  if (!issue.due_date) {
    return "No target date";
  }

  const days = getDaysUntilDue(issue.due_date);

  if (days === null) {
    return "No target date";
  }

  if (!isIssueOpen(issue.status)) {
    return formatIssueDate(issue.due_date);
  }

  if (days < 0) {
    const overdueBy = Math.abs(days);
    return `${overdueBy} day${overdueBy === 1 ? "" : "s"} overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

export function toIssueFormPayload(
  form: NewIssue,
  includeEnterprise = false,
) {
  const payload: Record<string, unknown> = {
    title: form.title,
    description: form.description,
    source: form.source,
    severity: form.severity,
    status: form.status,
    identified_at: form.identified_at,
    due_date: form.due_date || null,
    root_cause: form.root_cause,
    remediation_plan: form.remediation_plan,
    closure_notes: form.closure_notes,
  };

  if (includeEnterprise) {
    payload.assignee_id = form.assignee_id || null;
  }

  return payload;
}
