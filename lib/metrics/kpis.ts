import { operatingBand } from "@/lib/risk/ratings";
import type { RiskCategory } from "@/lib/settings/defaults";
import { isAppetiteBreach, isActiveRisk } from "@/lib/taxonomy";
import { getTestingStatus, type Control } from "@/lib/types/control";
import { isIncidentOpen, type Incident } from "@/lib/types/incident";
import {
  isIssueOpen,
  isIssueOverdue,
  type Issue,
} from "@/lib/types/issue";
import type { Risk } from "@/lib/types/risk";

export function activeRisks(risks: Risk[]) {
  return risks.filter(isActiveRisk);
}

export function highCriticalRisks(risks: Risk[]) {
  return activeRisks(risks).filter((risk) => {
    const band = operatingBand(risk);
    return band === "High" || band === "Critical";
  });
}

export function appetiteBreachingRisks(
  risks: Risk[],
  categories: RiskCategory[],
) {
  return risks.filter((risk) => isAppetiteBreach(risk, categories));
}

export function overdueControls(
  controls: Control[],
  options: { keyOnly?: boolean } = {},
) {
  return controls.filter(
    (control) =>
      (!options.keyOnly || control.is_key) &&
      getTestingStatus(control.last_tested_at, control.is_key) === "Overdue",
  );
}

export function openIncidents(incidents: Incident[]) {
  return incidents.filter((incident) => isIncidentOpen(incident.status));
}

export function severeOpenIncidents(incidents: Incident[]) {
  return openIncidents(incidents).filter(
    (incident) =>
      incident.severity === "high" || incident.severity === "critical",
  );
}

export function openIssues(issues: Issue[]) {
  return issues.filter((issue) => isIssueOpen(issue.status));
}

export function overdueIssues(issues: Issue[]) {
  return issues.filter(isIssueOverdue);
}

export function uncontrolledRisks(
  risks: Risk[],
  linkedControlCountsByRisk: Record<string, number>,
) {
  return activeRisks(risks).filter(
    (risk) => (linkedControlCountsByRisk[risk.id] ?? 0) === 0,
  );
}

export function uncontrolledHighCriticalRisks(
  risks: Risk[],
  linkedControlCountsByRisk: Record<string, number>,
) {
  return highCriticalRisks(risks).filter(
    (risk) => (linkedControlCountsByRisk[risk.id] ?? 0) === 0,
  );
}
