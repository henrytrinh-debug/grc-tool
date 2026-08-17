import { groupJoinRows } from "@/lib/types/join-utils";
import {
  INCIDENT_JOIN_COLUMNS,
  RISK_JOIN_COLUMNS,
  RISK_JOIN_COLUMNS_WITH_CATEGORY,
  toLinkedIncident,
  toLinkedRisk,
  type IncidentJoin,
  type JoinRelation,
  type RiskJoin,
} from "@/lib/types/linked-entities";

export const INCIDENT_RISK_RISK_SELECT = `id, incident_id, risk_id, ${RISK_JOIN_COLUMNS}`;
export const INCIDENT_RISK_RISK_SELECT_WITH_CATEGORY = `id, incident_id, risk_id, ${RISK_JOIN_COLUMNS_WITH_CATEGORY}`;

export const INCIDENT_RISK_INCIDENT_SELECT = `id, incident_id, risk_id, ${INCIDENT_JOIN_COLUMNS}`;

export type IncidentRiskRow = {
  id: string;
  incident_id: string;
  risk_id: string;
  risks: JoinRelation<RiskJoin>;
};

export type IncidentRiskIncidentRow = {
  id: string;
  incident_id: string;
  risk_id: string;
  incidents: JoinRelation<IncidentJoin>;
};

/** Risks linked to each incident, keyed by incident id. */
export function groupIncidentRiskRowsByIncident(rows: IncidentRiskRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.incident_id,
    (row) => row.risks,
    (row, risk) => toLinkedRisk(row.id, row.risk_id, risk),
  );
}

/** Incidents linked to each risk, keyed by risk id. */
export function groupIncidentRiskRowsByRisk(rows: IncidentRiskIncidentRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.risk_id,
    (row) => row.incidents,
    (row, incident) => toLinkedIncident(row.id, row.incident_id, incident),
  );
}
