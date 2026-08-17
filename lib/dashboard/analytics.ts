import { getSettings } from "@/lib/settings/store";
import { formatEffectiveness, type Control } from "@/lib/types/control";
import { formatIncidentStatus, type Incident } from "@/lib/types/incident";
import {
  formatIssueStatus,
  isIssueOpen,
  isIssueOverdue,
  type Issue,
  type IssueSeverity,
  type IssueStatus,
} from "@/lib/types/issue";
import {
  getActionProgress,
  type IssueAction,
} from "@/lib/types/issue-action";
import { isActiveRisk } from "@/lib/taxonomy";
import type { Risk } from "@/lib/types/risk";

export type SeverityBand = "Low" | "Medium" | "High" | "Critical";

export type SeverityBandCount = {
  band: SeverityBand;
  count: number;
};

export type ChartCount = {
  name: string;
  value: number;
  filterValue: string;
};

export function getRiskScore(likelihood: number, impact: number) {
  return likelihood * impact;
}

export function getSeverityBand(score: number): SeverityBand {
  const bands = getSettings().bandMaxScores;

  if (score <= bands.Low) {
    return "Low";
  }

  if (score <= bands.Medium) {
    return "Medium";
  }

  if (score <= bands.High) {
    return "High";
  }

  return "Critical";
}

export function buildRiskHeatMap(risks: Risk[]) {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));

  for (const risk of risks.filter(isActiveRisk)) {
    const likelihoodIndex = risk.likelihood - 1;
    const impactIndex = risk.impact - 1;

    if (
      likelihoodIndex >= 0 &&
      likelihoodIndex < 5 &&
      impactIndex >= 0 &&
      impactIndex < 5
    ) {
      grid[likelihoodIndex][impactIndex] += 1;
    }
  }

  return grid;
}

export function buildSeverityBandCounts(risks: Risk[]): SeverityBandCount[] {
  const counts: Record<SeverityBand, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  for (const risk of risks.filter(isActiveRisk)) {
    const band = getSeverityBand(getRiskScore(risk.likelihood, risk.impact));
    counts[band] += 1;
  }

  return [
    { band: "Low", count: counts.Low },
    { band: "Medium", count: counts.Medium },
    { band: "High", count: counts.High },
    { band: "Critical", count: counts.Critical },
  ];
}

/** Color for a likelihood × impact cell, independent of how many risks sit in it. */
export function getScoreHeatColor(score: number) {
  const ratio = (Math.min(25, Math.max(1, score)) - 1) / 24;
  const hue = 120 - ratio * 120;

  return `hsl(${hue} 65% 42%)`;
}

export function getHeatMapCellColor(score: number, count: number) {
  if (count === 0) {
    return "rgb(241 245 249)";
  }

  return getScoreHeatColor(score);
}

export function buildControlEffectivenessCounts(
  controls: Control[],
): ChartCount[] {
  const counts = {
    effective: 0,
    ineffective: 0,
    not_tested: 0,
  };

  for (const control of controls) {
    counts[control.effectiveness] += 1;
  }

  return [
    {
      name: formatEffectiveness("effective"),
      value: counts.effective,
      filterValue: "effective",
    },
    {
      name: formatEffectiveness("ineffective"),
      value: counts.ineffective,
      filterValue: "ineffective",
    },
    {
      name: formatEffectiveness("not_tested"),
      value: counts.not_tested,
      filterValue: "not_tested",
    },
  ];
}

const ISSUE_STATUS_ORDER: IssueStatus[] = [
  "open",
  "in_progress",
  "pending_review",
  "closed",
];

const ISSUE_SEVERITY_ORDER: IssueSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export function buildIssueStatusCounts(issues: Issue[]): ChartCount[] {
  const counts: Record<IssueStatus, number> = {
    open: 0,
    in_progress: 0,
    pending_review: 0,
    closed: 0,
  };

  for (const issue of issues) {
    counts[issue.status] += 1;
  }

  return ISSUE_STATUS_ORDER.map((status) => ({
    name: formatIssueStatus(status),
    value: counts[status],
    filterValue: status,
  }));
}

export type IssueSeverityBreakdown = {
  severity: IssueSeverity;
  open: number;
  overdue: number;
};

/**
 * Open-issue counts per severity, with the overdue subset, so the dashboard can
 * show where remediation is slipping.
 */
export function buildOpenIssueSeverityBreakdown(
  issues: Issue[],
): IssueSeverityBreakdown[] {
  return ISSUE_SEVERITY_ORDER.map((severity) => {
    const matching = issues.filter(
      (issue) => issue.severity === severity && isIssueOpen(issue.status),
    );

    return {
      severity,
      open: matching.length,
      overdue: matching.filter((issue) => isIssueOverdue(issue)).length,
    };
  });
}

export type IssueSummary = {
  total: number;
  open: number;
  overdue: number;
  awaitingReview: number;
  actionCompletionPercent: number;
};

export function summariseIssues(
  issues: Issue[],
  actions: IssueAction[],
): IssueSummary {
  const openIssues = issues.filter((issue) => isIssueOpen(issue.status));
  const openIssueIds = new Set(openIssues.map((issue) => issue.id));
  const openActions = actions.filter((action) =>
    openIssueIds.has(action.issue_id),
  );

  return {
    total: issues.length,
    open: openIssues.length,
    overdue: issues.filter((issue) => isIssueOverdue(issue)).length,
    awaitingReview: issues.filter((issue) => issue.status === "pending_review")
      .length,
    actionCompletionPercent: getActionProgress(openActions).percent,
  };
}

export function buildIncidentStatusCounts(incidents: Incident[]): ChartCount[] {
  const counts = {
    open: 0,
    investigating: 0,
    resolved: 0,
  };

  for (const incident of incidents) {
    counts[incident.status] += 1;
  }

  return [
    {
      name: formatIncidentStatus("open"),
      value: counts.open,
      filterValue: "open",
    },
    {
      name: formatIncidentStatus("investigating"),
      value: counts.investigating,
      filterValue: "investigating",
    },
    {
      name: formatIncidentStatus("resolved"),
      value: counts.resolved,
      filterValue: "resolved",
    },
  ];
}

export function buildTaxonomyRiskCounts(
  risks: Risk[],
  categories: { id: string; name: string }[],
): ChartCount[] {
  const active = risks.filter((risk) => risk.status !== "closed");
  const counts = new Map<string, number>();

  for (const risk of active) {
    const key = risk.category_id || "uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows: ChartCount[] = categories.map((category) => ({
    name: category.name,
    value: counts.get(category.id) ?? 0,
    filterValue: category.id,
  }));

  const uncategorised = counts.get("uncategorised") ?? 0;
  if (uncategorised > 0 || categories.length === 0) {
    rows.push({
      name: "Uncategorised",
      value: uncategorised,
      filterValue: "uncategorised",
    });
  }

  return rows;
}

export function buildTreatmentCounts(risks: Risk[]): ChartCount[] {
  const active = risks.filter((risk) => risk.status !== "closed");
  const counts = {
    mitigate: 0,
    accept: 0,
    transfer: 0,
    avoid: 0,
  };

  for (const risk of active) {
    const treatment = risk.treatment ?? "mitigate";
    counts[treatment] += 1;
  }

  return [
    { name: "Mitigate", value: counts.mitigate, filterValue: "mitigate" },
    { name: "Accept", value: counts.accept, filterValue: "accept" },
    { name: "Transfer", value: counts.transfer, filterValue: "transfer" },
    { name: "Avoid", value: counts.avoid, filterValue: "avoid" },
  ];
}
