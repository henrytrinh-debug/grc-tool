import {
  formatEffectiveness,
  type Effectiveness,
} from "@/lib/types/control";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
  type IncidentStatus,
  type Severity,
} from "@/lib/types/incident";
import {
  formatIssueSeverity,
  formatIssueStatus,
  isIssueOpen,
  isIssueOverdue,
  type IssueSeverity,
  type IssueStatus,
} from "@/lib/types/issue";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedIssue,
} from "@/lib/types/linked-entities";

export type ControlsSummary = {
  total: number;
  keyCount: number;
  nonKeyCount: number;
  effectiveness: Record<Effectiveness, number>;
};

export type IncidentsSummary = {
  total: number;
  severity: Record<Severity, number>;
  status: Record<IncidentStatus, number>;
  mostRecentDate: string | null;
};

export function buildControlsSummary(
  links: LinkedControl[],
): ControlsSummary {
  const summary: ControlsSummary = {
    total: links.length,
    keyCount: 0,
    nonKeyCount: 0,
    effectiveness: {
      effective: 0,
      ineffective: 0,
      not_tested: 0,
    },
  };

  for (const link of links) {
    if (link.is_key) {
      summary.keyCount += 1;
    } else {
      summary.nonKeyCount += 1;
    }

    summary.effectiveness[link.effectiveness] += 1;
  }

  return summary;
}

export function buildIncidentsSummary(
  links: LinkedIncident[],
): IncidentsSummary {
  const summary: IncidentsSummary = {
    total: links.length,
    severity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    status: {
      open: 0,
      investigating: 0,
      resolved: 0,
    },
    mostRecentDate: null,
  };

  for (const link of links) {
    summary.severity[link.severity] += 1;
    summary.status[link.status] += 1;

    if (
      !summary.mostRecentDate ||
      link.date_occurred > summary.mostRecentDate
    ) {
      summary.mostRecentDate = link.date_occurred;
    }
  }

  return summary;
}

export function formatEffectivenessBreakdown(
  effectiveness: ControlsSummary["effectiveness"],
) {
  return (Object.keys(effectiveness) as Effectiveness[])
    .map(
      (key) =>
        `${formatEffectiveness(key)}: ${effectiveness[key]}`,
    )
    .join(" · ");
}

export function formatSeverityBreakdown(
  severity: IncidentsSummary["severity"],
) {
  return (Object.keys(severity) as Severity[])
    .map((key) => `${formatSeverity(key)}: ${severity[key]}`)
    .join(" · ");
}

export function formatStatusBreakdown(status: IncidentsSummary["status"]) {
  return (Object.keys(status) as IncidentStatus[])
    .map((key) => `${formatIncidentStatus(key)}: ${status[key]}`)
    .join(" · ");
}

export function formatMostRecentIncidentDate(
  mostRecentDate: string | null,
) {
  if (!mostRecentDate) {
    return "—";
  }

  return formatDateOccurred(mostRecentDate);
}

export type IssuesSummary = {
  total: number;
  open: number;
  overdue: number;
  severity: Record<IssueSeverity, number>;
  status: Record<IssueStatus, number>;
};

export function buildIssuesSummary(links: LinkedIssue[]): IssuesSummary {
  const summary: IssuesSummary = {
    total: links.length,
    open: 0,
    overdue: 0,
    severity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    status: {
      open: 0,
      in_progress: 0,
      pending_review: 0,
      closed: 0,
    },
  };

  for (const link of links) {
    summary.severity[link.severity] += 1;
    summary.status[link.status] += 1;

    if (isIssueOpen(link.status)) {
      summary.open += 1;
      if (isIssueOverdue(link)) {
        summary.overdue += 1;
      }
    }
  }

  return summary;
}

export function formatIssueSeverityBreakdown(
  severity: IssuesSummary["severity"],
) {
  return (Object.keys(severity) as IssueSeverity[])
    .map((key) => `${formatIssueSeverity(key)}: ${severity[key]}`)
    .join(" · ");
}

export function formatIssueStatusBreakdown(status: IssuesSummary["status"]) {
  return (Object.keys(status) as IssueStatus[])
    .map((key) => `${formatIssueStatus(key)}: ${status[key]}`)
    .join(" · ");
}
