import type { Effectiveness } from "@/lib/types/control";
import type { IncidentStatus, Severity } from "@/lib/types/incident";
import type { IssueSeverity, IssueStatus } from "@/lib/types/issue";

/**
 * Display shapes for rows read through a join table. `linkId` is the join-row
 * id (used to unlink) and the other id is the related record.
 */

export type LinkedRisk = {
  linkId: string;
  riskId: string;
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
};

export type LinkedControl = {
  linkId: string;
  controlId: string;
  title: string;
  effectiveness: Effectiveness;
  last_tested_at: string | null;
  is_key: boolean;
};

export type LinkedIncident = {
  linkId: string;
  incidentId: string;
  title: string;
  date_occurred: string;
  severity: Severity;
  status: IncidentStatus;
};

export type LinkedIssue = {
  linkId: string;
  issueId: string;
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  due_date: string | null;
};

/**
 * The columns each join query embeds, and the payload they return. Supabase
 * gives an embedded relation back as either an object or a single-element array
 * depending on how it infers the relationship, hence `JoinRelation`.
 */

export type JoinRelation<T> = T | T[] | null;

export const RISK_JOIN_COLUMNS = "risks(title, likelihood, impact, owner_email)";
export const CONTROL_JOIN_COLUMNS =
  "controls(title, effectiveness, last_tested_at, is_key)";
export const INCIDENT_JOIN_COLUMNS =
  "incidents(title, date_occurred, severity, status)";
export const ISSUE_JOIN_COLUMNS = "issues(title, severity, status, due_date)";

export type RiskJoin = {
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
};

export type ControlJoin = {
  title: string;
  effectiveness: Effectiveness;
  last_tested_at: string | null;
  is_key: boolean;
};

export type IncidentJoin = {
  title: string;
  date_occurred: string;
  severity: Severity;
  status: IncidentStatus;
};

export type IssueJoin = {
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  due_date: string | null;
};

export function toLinkedRisk(
  linkId: string,
  riskId: string,
  risk: RiskJoin,
): LinkedRisk {
  return {
    linkId,
    riskId,
    title: risk.title,
    likelihood: risk.likelihood,
    impact: risk.impact,
    owner_email: risk.owner_email,
  };
}

export function toLinkedControl(
  linkId: string,
  controlId: string,
  control: ControlJoin,
): LinkedControl {
  return {
    linkId,
    controlId,
    title: control.title,
    effectiveness: control.effectiveness,
    last_tested_at: control.last_tested_at,
    is_key: Boolean(control.is_key),
  };
}

export function toLinkedIncident(
  linkId: string,
  incidentId: string,
  incident: IncidentJoin,
): LinkedIncident {
  return {
    linkId,
    incidentId,
    title: incident.title,
    date_occurred: incident.date_occurred,
    severity: incident.severity,
    status: incident.status,
  };
}

export function toLinkedIssue(
  linkId: string,
  issueId: string,
  issue: IssueJoin,
): LinkedIssue {
  return {
    linkId,
    issueId,
    title: issue.title,
    severity: issue.severity,
    status: issue.status,
    due_date: issue.due_date,
  };
}
