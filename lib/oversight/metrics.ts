import {
  getRiskScore,
  getSeverityBand,
  type ChartCount,
  type SeverityBand,
} from "@/lib/dashboard/analytics";
import { getTestingStatus, type Control } from "@/lib/types/control";
import type { ControlTestResult } from "@/lib/types/control-test-result";
import type { Incident } from "@/lib/types/incident";
import {
  formatIssueSource,
  isIssueOpen,
  isIssueOverdue,
  ISSUE_SOURCE_OPTIONS,
  type Issue,
  type IssueSeverity,
} from "@/lib/types/issue";
import type { Risk } from "@/lib/types/risk";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Positive when `laterMs` is after `earlierMs`. */
function daysBetween(laterMs: number, earlierMs: number) {
  return (laterMs - earlierMs) / DAY_MS;
}

function isWithinTrailingDays(
  dateIso: string | null | undefined,
  days: number,
) {
  if (!dateIso) {
    return false;
  }

  const diff = daysBetween(Date.now(), new Date(dateIso).getTime());
  return diff >= 0 && diff <= days;
}

// ---------------------------------------------------------------------------
// Controls — design/coverage of the control environment
// ---------------------------------------------------------------------------

export type ControlKeyStats = {
  total: number;
  key: number;
  nonKey: number;
  keyPercent: number;
};

export function buildControlKeyStats(controls: Control[]): ControlKeyStats {
  const total = controls.length;
  const key = controls.filter((control) => control.is_key).length;

  return {
    total,
    key,
    nonKey: total - key,
    keyPercent: total === 0 ? 0 : Math.round((key / total) * 100),
  };
}

export function toControlKeySplitChartCounts(
  stats: ControlKeyStats,
): ChartCount[] {
  return [
    { name: "Key", value: stats.key, filterValue: "true" },
    { name: "Non-Key", value: stats.nonKey, filterValue: "false" },
  ];
}

export type TestingCoverage = {
  neverTested: number;
  tested: number;
  overdue: number;
};

/** Coverage counts from the cached `getTestingStatus` snapshot. Call with a
 * pre-filtered array (e.g. key controls only) to get a scoped breakdown. */
export function buildTestingCoverage(controls: Control[]): TestingCoverage {
  const coverage: TestingCoverage = { neverTested: 0, tested: 0, overdue: 0 };

  for (const control of controls) {
    const status = getTestingStatus(control.last_tested_at);

    if (status === "Never Tested") {
      coverage.neverTested += 1;
    } else if (status === "Overdue") {
      coverage.overdue += 1;
    } else {
      coverage.tested += 1;
    }
  }

  return coverage;
}

export function toTestingCoverageChartCounts(
  coverage: TestingCoverage,
): ChartCount[] {
  return [
    { name: "Never Tested", value: coverage.neverTested, filterValue: "Never Tested" },
    { name: "Tested", value: coverage.tested, filterValue: "Tested" },
    { name: "Overdue", value: coverage.overdue, filterValue: "Overdue" },
  ];
}

export type TestPassRate = {
  effectiveCount: number;
  ineffectiveCount: number;
  totalRecorded: number;
  /** null when there is no recorded test history to compute a rate from. */
  passRatePercent: number | null;
};

/** Pass rate across full test history, not just each control's cached
 * snapshot — so a control that failed then passed on retest counts both. */
export function buildTestPassRate(
  results: ControlTestResult[],
): TestPassRate {
  const effectiveCount = results.filter(
    (result) => result.effectiveness === "effective",
  ).length;
  const ineffectiveCount = results.filter(
    (result) => result.effectiveness === "ineffective",
  ).length;
  const totalRecorded = effectiveCount + ineffectiveCount;

  return {
    effectiveCount,
    ineffectiveCount,
    totalRecorded,
    passRatePercent:
      totalRecorded === 0
        ? null
        : Math.round((effectiveCount / totalRecorded) * 100),
  };
}

export type UncontrolledRiskBreakdown = {
  band: SeverityBand;
  count: number;
};

/** Risks with zero linked controls, broken out by severity band so
 * uncontrolled High/Critical exposure stands out. */
export function buildUncontrolledRisks(
  risks: Risk[],
  riskControlLinks: { risk_id: string }[],
): UncontrolledRiskBreakdown[] {
  const linkedRiskIds = new Set(riskControlLinks.map((link) => link.risk_id));
  const counts: Record<SeverityBand, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  for (const risk of risks) {
    if (linkedRiskIds.has(risk.id)) {
      continue;
    }

    counts[getSeverityBand(getRiskScore(risk.likelihood, risk.impact))] += 1;
  }

  return [
    { band: "Low", count: counts.Low },
    { band: "Medium", count: counts.Medium },
    { band: "High", count: counts.High },
    { band: "Critical", count: counts.Critical },
  ];
}

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

export type StaleReviewBreakdown = {
  never: number;
  within180: number;
  between180And365: number;
  over365: number;
};

/** Buckets risks by how long ago they were last reviewed in `rcsa_reviews`,
 * taking the newest `reviewed_at` per risk. A risk with no review row at all
 * falls into `never`. */
export function buildStaleReviewBreakdown(
  risks: Risk[],
  reviews: { risk_id: string; reviewed_at: string }[],
): StaleReviewBreakdown {
  const lastReviewedByRisk = new Map<string, string>();

  for (const review of reviews) {
    const current = lastReviewedByRisk.get(review.risk_id);
    if (!current || review.reviewed_at > current) {
      lastReviewedByRisk.set(review.risk_id, review.reviewed_at);
    }
  }

  const breakdown: StaleReviewBreakdown = {
    never: 0,
    within180: 0,
    between180And365: 0,
    over365: 0,
  };

  for (const risk of risks) {
    const lastReviewedAt = lastReviewedByRisk.get(risk.id);

    if (!lastReviewedAt) {
      breakdown.never += 1;
      continue;
    }

    const daysSince = daysBetween(Date.now(), new Date(lastReviewedAt).getTime());

    if (daysSince > 365) {
      breakdown.over365 += 1;
    } else if (daysSince > 180) {
      breakdown.between180And365 += 1;
    } else {
      breakdown.within180 += 1;
    }
  }

  return breakdown;
}

// ---------------------------------------------------------------------------
// Issues & remediation
// ---------------------------------------------------------------------------

export type IssueAgingBucketLabel = "0-30" | "31-60" | "61-90" | "90+";

export type IssueAgingBucket = {
  bucket: IssueAgingBucketLabel;
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
};

const AGING_BUCKET_LABELS: IssueAgingBucketLabel[] = [
  "0-30",
  "31-60",
  "61-90",
  "90+",
];

function getAgingBucket(ageDays: number): IssueAgingBucketLabel {
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  return "90+";
}

/** Open-issue age (days since `identified_at`) grouped into buckets, broken
 * out by severity so a growing backlog of Critical/High findings is visible. */
export function buildOpenIssueAgingBuckets(issues: Issue[]): IssueAgingBucket[] {
  const buckets: Record<IssueAgingBucketLabel, IssueAgingBucket> =
    Object.fromEntries(
      AGING_BUCKET_LABELS.map((bucket) => [
        bucket,
        { bucket, low: 0, medium: 0, high: 0, critical: 0, total: 0 },
      ]),
    ) as Record<IssueAgingBucketLabel, IssueAgingBucket>;

  for (const issue of issues) {
    if (!isIssueOpen(issue.status)) {
      continue;
    }

    const ageDays = daysBetween(
      Date.now(),
      new Date(issue.identified_at).getTime(),
    );
    const bucket = buckets[getAgingBucket(ageDays)];
    bucket[issue.severity] += 1;
    bucket.total += 1;
  }

  return AGING_BUCKET_LABELS.map((label) => buckets[label]);
}

export type FlowCounts = {
  opened: number;
  closed: number;
};

export type IssueFlow = {
  last30: FlowCounts;
  last90: FlowCounts;
};

/** Issues opened vs closed in the trailing window, so backlog growth or
 * shrinkage is visible at a glance. */
export function buildIssueFlow(issues: Issue[]): IssueFlow {
  const countOpened = (days: number) =>
    issues.filter((issue) => isWithinTrailingDays(issue.identified_at, days))
      .length;
  const countClosed = (days: number) =>
    issues.filter((issue) => isWithinTrailingDays(issue.closed_at, days))
      .length;

  return {
    last30: { opened: countOpened(30), closed: countClosed(30) },
    last90: { opened: countOpened(90), closed: countClosed(90) },
  };
}

/** % of currently-open issues that are overdue (mirrors `isIssueOverdue`,
 * which already only flags open issues). */
export function getOpenIssueOverduePercent(issues: Issue[]): number {
  const open = issues.filter((issue) => isIssueOpen(issue.status));
  if (open.length === 0) {
    return 0;
  }

  const overdue = open.filter((issue) => isIssueOverdue(issue)).length;
  return Math.round((overdue / open.length) * 100);
}

/** Average days from `identified_at` to `closed_at` for closed issues. */
export function buildAvgDaysToCloseIssues(issues: Issue[]): number | null {
  const closed = issues.filter(
    (issue): issue is Issue & { closed_at: string } =>
      issue.status === "closed" && Boolean(issue.closed_at),
  );

  if (closed.length === 0) {
    return null;
  }

  const totalDays = closed.reduce(
    (sum, issue) =>
      sum +
      daysBetween(
        new Date(issue.closed_at).getTime(),
        new Date(issue.identified_at).getTime(),
      ),
    0,
  );

  return Math.round(totalDays / closed.length);
}

const ISSUE_SOURCES = ISSUE_SOURCE_OPTIONS.map((option) => option.value);

/** Open issues grouped by originating source — shows which upstream process
 * (audits, control failures, incidents, ...) is generating the most findings. */
export function buildOpenIssuesBySource(issues: Issue[]): ChartCount[] {
  const counts = Object.fromEntries(
    ISSUE_SOURCES.map((source) => [source, 0]),
  ) as Record<(typeof ISSUE_SOURCES)[number], number>;

  for (const issue of issues) {
    if (isIssueOpen(issue.status)) {
      counts[issue.source] += 1;
    }
  }

  return ISSUE_SOURCES.map((source) => ({
    name: formatIssueSource(source),
    value: counts[source],
    filterValue: source,
  }));
}

export const ISSUE_SEVERITY_COLORS: Record<IssueSeverity, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export type IncidentStock = {
  openCount: number;
  averageAgeDays: number | null;
};

/** Count and average age (days since `date_occurred`) of incidents still
 * open or under investigation. */
export function buildIncidentStock(incidents: Incident[]): IncidentStock {
  const openIncidents = incidents.filter(
    (incident) => incident.status === "open" || incident.status === "investigating",
  );

  if (openIncidents.length === 0) {
    return { openCount: 0, averageAgeDays: null };
  }

  const totalAgeDays = openIncidents.reduce(
    (sum, incident) =>
      sum + daysBetween(Date.now(), new Date(incident.date_occurred).getTime()),
    0,
  );

  return {
    openCount: openIncidents.length,
    averageAgeDays: Math.round(totalAgeDays / openIncidents.length),
  };
}

export type IncidentFlow = {
  last30: FlowCounts;
  last90: FlowCounts;
  /** False when no incident has a `resolved_at` value yet — i.e. the
   * 002_incident_resolved_at.sql migration hasn't been applied/used yet. */
  hasResolvedData: boolean;
};

/** New vs resolved incidents in the trailing window. Resolved counts use
 * `resolved_at` (stamped on create/edit, and backfilled for older resolved
 * rows from `created_at`). */
export function buildIncidentFlow(incidents: Incident[]): IncidentFlow {
  const countNew = (days: number) =>
    incidents.filter((incident) => isWithinTrailingDays(incident.date_occurred, days))
      .length;
  const countResolved = (days: number) =>
    incidents.filter((incident) => isWithinTrailingDays(incident.resolved_at, days))
      .length;

  return {
    last30: { opened: countNew(30), closed: countResolved(30) },
    last90: { opened: countNew(90), closed: countResolved(90) },
    hasResolvedData: incidents.some((incident) => Boolean(incident.resolved_at)),
  };
}

/** Average days from `date_occurred` to `resolved_at`, for incidents that
 * have a `resolved_at` value recorded. */
export function buildAvgDaysToResolveIncidents(
  incidents: Incident[],
): number | null {
  const resolved = incidents.filter(
    (incident): incident is Incident & { resolved_at: string } =>
      Boolean(incident.resolved_at),
  );

  if (resolved.length === 0) {
    return null;
  }

  const totalDays = resolved.reduce(
    (sum, incident) =>
      sum +
      daysBetween(
        new Date(incident.resolved_at).getTime(),
        new Date(incident.date_occurred).getTime(),
      ),
    0,
  );

  return Math.round(totalDays / resolved.length);
}

export function buildIncidentSeverityCounts(incidents: Incident[]): ChartCount[] {
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const incident of incidents) {
    counts[incident.severity] += 1;
  }

  return [
    { name: "Low", value: counts.low, filterValue: "low" },
    { name: "Medium", value: counts.medium, filterValue: "medium" },
    { name: "High", value: counts.high, filterValue: "high" },
    { name: "Critical", value: counts.critical, filterValue: "critical" },
  ];
}
