export type Severity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "resolved";

export type Incident = {
  id: string;
  title: string;
  description: string;
  date_occurred: string;
  severity: Severity;
  status: IncidentStatus;
  root_cause: string;
  resolved_at?: string | null;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewIncident = Pick<
  Incident,
  | "title"
  | "description"
  | "date_occurred"
  | "severity"
  | "status"
  | "root_cause"
>;

export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUS_OPTIONS: { value: IncidentStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
];

export function formatSeverity(severity: Severity) {
  return (
    SEVERITY_OPTIONS.find((option) => option.value === severity)?.label ??
    severity
  );
}

export function formatIncidentStatus(status: IncidentStatus) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
  );
}

export function formatDateForInput(dateOccurred: string | null | undefined) {
  if (!dateOccurred) {
    return "";
  }

  return dateOccurred.slice(0, 10);
}

export function formatDateOccurred(dateOccurred: string | null | undefined) {
  if (!dateOccurred) {
    return "—";
  }

  return new Date(dateOccurred).toLocaleDateString();
}

export function toIncidentFormPayload(form: NewIncident) {
  return {
    title: form.title,
    description: form.description,
    date_occurred: form.date_occurred,
    severity: form.severity,
    status: form.status,
    root_cause: form.root_cause,
  };
}

/**
 * Stamp `resolved_at` the first time status becomes resolved; clear it on
 * reopen. Mirrors `issue_actions.completed_at` / `issues.closed_at`.
 */
export function nextResolvedAt(
  status: IncidentStatus,
  current: string | null | undefined,
) {
  if (status !== "resolved") {
    return null;
  }

  return current ?? new Date().toISOString();
}

/** Best-effort timestamp for incidents that were already resolved before
 * `resolved_at` existed. `created_at` is the closest recorded time; using
 * "now" would dump historical closures into the trailing 30-day flow. */
export function fallbackResolvedAt(incident: Incident) {
  return incident.created_at ?? new Date().toISOString();
}
