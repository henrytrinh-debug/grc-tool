import type { IncidentStatus, Severity } from "@/lib/types/incident";
import { unwrapJoinRelation } from "@/lib/types/risk-control";

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

type RiskJoin = {
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
};

type IncidentJoin = {
  title: string;
  date_occurred: string;
  severity: Severity;
  status: IncidentStatus;
};

export type IncidentRiskRow = {
  id: string;
  incident_id: string;
  risk_id: string;
  risks: RiskJoin | RiskJoin[] | null;
};

export type IncidentRiskIncidentRow = {
  id: string;
  incident_id: string;
  risk_id: string;
  incidents: IncidentJoin | IncidentJoin[] | null;
};

export function groupIncidentRiskRowsByIncident(
  rows: IncidentRiskRow[],
): Record<string, LinkedRisk[]> {
  const grouped: Record<string, LinkedRisk[]> = {};

  for (const row of rows) {
    const risk = unwrapJoinRelation(row.risks);

    if (!risk) {
      continue;
    }

    if (!grouped[row.incident_id]) {
      grouped[row.incident_id] = [];
    }

    grouped[row.incident_id].push({
      linkId: row.id,
      riskId: row.risk_id,
      title: risk.title,
      likelihood: risk.likelihood,
      impact: risk.impact,
      owner_email: risk.owner_email,
    });
  }

  return grouped;
}

export function groupIncidentRiskRowsByRisk(
  rows: IncidentRiskIncidentRow[],
): Record<string, LinkedIncident[]> {
  const grouped: Record<string, LinkedIncident[]> = {};

  for (const row of rows) {
    const incident = unwrapJoinRelation(row.incidents);

    if (!incident) {
      continue;
    }

    if (!grouped[row.risk_id]) {
      grouped[row.risk_id] = [];
    }

    grouped[row.risk_id].push({
      linkId: row.id,
      incidentId: row.incident_id,
      title: incident.title,
      date_occurred: incident.date_occurred,
      severity: incident.severity,
      status: incident.status,
    });
  }

  return grouped;
}
