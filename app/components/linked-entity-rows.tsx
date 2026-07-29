import type { LinkedRow } from "./linked-entities-panel";
import {
  EffectivenessBadge,
  IncidentSeverityBadge,
  IncidentStatusBadge,
  KeyBadge,
  SeverityBandBadge,
} from "./status-badge";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { formatEffectiveness } from "@/lib/types/control";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
} from "@/lib/types/incident";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedRisk,
} from "@/lib/types/linked-entities";

/**
 * Column headers and cell builders for the linked-entity tables, so every page
 * that links to risks, controls, or incidents renders them identically.
 */

export const RISK_COLUMNS = ["Title", "Likelihood", "Impact", "Rating"];
export const RISK_COLUMNS_WITH_OWNER = [...RISK_COLUMNS, "Owner"];
export const CONTROL_COLUMNS = ["Title", "Effectiveness", "Key"];
export const INCIDENT_COLUMNS = [
  "Title",
  "Date Occurred",
  "Severity",
  "Status",
];

export function buildRiskRows(
  links: LinkedRisk[],
  { includeOwner = false }: { includeOwner?: boolean } = {},
): LinkedRow[] {
  return links.map((link) => ({
    linkId: link.linkId,
    entityId: link.riskId,
    title: link.title,
    cells: [
      link.title,
      link.likelihood,
      link.impact,
      <SeverityBandBadge
        key="band"
        band={getSeverityBand(getRiskScore(link.likelihood, link.impact))}
      />,
      ...(includeOwner ? [link.owner_email ?? "—"] : []),
    ],
  }));
}

export function buildControlRows(links: LinkedControl[]): LinkedRow[] {
  return links.map((link) => ({
    linkId: link.linkId,
    entityId: link.controlId,
    title: link.title,
    cells: [
      link.title,
      <EffectivenessBadge
        key="effectiveness"
        effectiveness={link.effectiveness}
        label={formatEffectiveness(link.effectiveness)}
      />,
      <KeyBadge key="key" isKey={link.is_key} />,
    ],
  }));
}

export function buildIncidentRows(links: LinkedIncident[]): LinkedRow[] {
  return links.map((link) => ({
    linkId: link.linkId,
    entityId: link.incidentId,
    title: link.title,
    cells: [
      link.title,
      formatDateOccurred(link.date_occurred),
      <IncidentSeverityBadge
        key="severity"
        severity={link.severity}
        label={formatSeverity(link.severity)}
      />,
      <IncidentStatusBadge
        key="status"
        status={link.status}
        label={formatIncidentStatus(link.status)}
      />,
    ],
  }));
}
