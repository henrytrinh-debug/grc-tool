import type { IncidentStatus, Severity } from "@/lib/types/incident";

export type IncidentRisk = {
  id: string;
  incident_id: string;
  risk_id: string;
  owner_id?: string;
};

export type LinkedRisk = {
  linkId: string;
  riskId: string;
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
};

export type LinkedIncident = {
  linkId: string;
  incidentId: string;
  title: string;
  date_occurred: string;
  severity: Severity;
  status: IncidentStatus;
};

export type IncidentRiskRow = {
  id: string;
  incident_id: string;
  risk_id: string;
  risks: {
    title: string;
    likelihood: number;
    impact: number;
    owner_email?: string;
  } | null;
};

export type IncidentRiskIncidentRow = {
  id: string;
  incident_id: string;
  risk_id: string;
  incidents: {
    title: string;
    date_occurred: string;
    severity: Severity;
    status: IncidentStatus;
  } | null;
};

export function groupIncidentRiskRowsByIncident(
  rows: IncidentRiskRow[],
): Record<string, LinkedRisk[]> {
  const grouped: Record<string, LinkedRisk[]> = {};

  for (const row of rows) {
    if (!row.risks) {
      continue;
    }

    if (!grouped[row.incident_id]) {
      grouped[row.incident_id] = [];
    }

    grouped[row.incident_id].push({
      linkId: row.id,
      riskId: row.risk_id,
      title: row.risks.title,
      likelihood: row.risks.likelihood,
      impact: row.risks.impact,
      owner_email: row.risks.owner_email,
    });
  }

  return grouped;
}

export function groupIncidentRiskRowsByRisk(
  rows: IncidentRiskIncidentRow[],
): Record<string, LinkedIncident[]> {
  const grouped: Record<string, LinkedIncident[]> = {};

  for (const row of rows) {
    if (!row.incidents) {
      continue;
    }

    if (!grouped[row.risk_id]) {
      grouped[row.risk_id] = [];
    }

    grouped[row.risk_id].push({
      linkId: row.id,
      incidentId: row.incident_id,
      title: row.incidents.title,
      date_occurred: row.incidents.date_occurred,
      severity: row.incidents.severity,
      status: row.incidents.status,
    });
  }

  return grouped;
}
