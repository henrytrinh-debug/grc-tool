import type { LinkedRow } from "./linked-entities-panel";
import {
  EffectivenessBadge,
  IncidentSeverityBadge,
  IncidentStatusBadge,
  IssueSeverityBadge,
  IssueStatusBadge,
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
  LinkedIssue,
  LinkedRisk,
} from "@/lib/types/linked-entities";
import {
  formatIssueSeverity,
  formatIssueStatus,
} from "@/lib/types/issue";
import { formatImpactOption, formatLikelihoodOption } from "@/lib/types/risk";

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
export const ISSUE_COLUMNS = ["Title", "Severity", "Status"];

export function buildRiskRows(
  links: LinkedRisk[],
  { includeOwner = false }: { includeOwner?: boolean } = {},
): LinkedRow[] {
  return links.map((link) => ({
    linkId: link.linkId,
    entityId: link.riskId,
    href: `/risks/${link.riskId}/edit`,
    title: link.title,
    cells: [
      link.title,
      formatLikelihoodOption(link.likelihood),
      formatImpactOption(link.impact),
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
    href: `/controls/${link.controlId}/edit`,
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
    href: `/incidents/${link.incidentId}/edit`,
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

export function buildIssueRows(links: LinkedIssue[]): LinkedRow[] {
  return links.map((link) => ({
    linkId: link.linkId,
    entityId: link.issueId,
    href: `/issues/${link.issueId}/edit`,
    title: link.title,
    cells: [
      link.title,
      <IssueSeverityBadge
        key="severity"
        severity={link.severity}
        label={formatIssueSeverity(link.severity)}
      />,
      <IssueStatusBadge
        key="status"
        status={link.status}
        label={formatIssueStatus(link.status)}
      />,
    ],
  }));
}
