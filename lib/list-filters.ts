import { isAppetiteBreach, matchesInheritedCategory, matchesCategoryFilter } from "@/lib/taxonomy";
import type { RiskCategory } from "@/lib/settings/defaults";
import {
  getRiskScore,
  getSeverityBand,
  type SeverityBand,
} from "@/lib/dashboard/analytics";
import {
  getTestingStatus,
  type Control,
  type ControlType,
  type Effectiveness,
} from "@/lib/types/control";
import {
  type Incident,
  type IncidentStatus,
  type Severity,
} from "@/lib/types/incident";
import {
  isIssueOverdue,
  type Issue,
  type IssueSeverity,
  type IssueSource,
  type IssueStatus,
} from "@/lib/types/issue";
import { getReviewRecencyBucket, isReviewDue } from "@/lib/types/rcsa";
import type { Risk, RiskStatus, RiskTreatment } from "@/lib/types/risk";

const RISK_TREATMENTS: RiskTreatment[] = [
  "mitigate",
  "accept",
  "transfer",
  "avoid",
];

const RISK_STATUSES: RiskStatus[] = ["open", "monitoring", "closed"];
const CONTROL_TYPES: ControlType[] = ["preventive", "detective", "corrective"];

export type RiskListFilters = {
  q: string;
  severity: SeverityBand | "";
  likelihood: number | null;
  impact: number | null;
  reviewRecency: "" | "never" | "over365" | "due";
  uncontrolled: boolean;
  categoryId: string;
  treatment: RiskTreatment | "";
  status: RiskStatus | "";
  assignee: string;
  appetiteBreach: boolean;
};

export type ControlListFilters = {
  q: string;
  effectiveness: Effectiveness | "";
  testingStatus: string;
  isKey: "" | "true" | "false";
  unmapped: boolean;
  categoryId: string;
  controlType: ControlType | "";
  assignee: string;
};

export type IncidentListFilters = {
  q: string;
  severity: Severity | "";
  status: IncidentStatus[];
  categoryId: string;
  assignee: string;
};

export type IssueListFilters = {
  q: string;
  severity: IssueSeverity | "";
  status: IssueStatus[];
  source: IssueSource | "";
  overdue: boolean;
  categoryId: string;
  assignee: string;
};

const ISSUE_SEVERITIES: IssueSeverity[] = ["low", "medium", "high", "critical"];

const ISSUE_STATUSES: IssueStatus[] = [
  "open",
  "in_progress",
  "pending_review",
  "closed",
];

const ISSUE_SOURCES: IssueSource[] = [
  "internal_audit",
  "external_audit",
  "regulatory_exam",
  "control_failure",
  "incident",
  "risk_assessment",
  "self_identified",
];

function getParam(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? "";
}

export function parseRiskFilters(params: URLSearchParams): RiskListFilters {
  const likelihoodRaw = getParam(params, "likelihood");
  const impactRaw = getParam(params, "impact");
  const severityRaw = getParam(params, "severity");
  const likelihood = Number(likelihoodRaw);
  const impact = Number(impactRaw);

  const recencyRaw = getParam(params, "reviewRecency");
  const treatmentRaw = getParam(params, "treatment") as RiskTreatment;
  const statusRaw = getParam(params, "status");

  return {
    q: getParam(params, "q"),
    severity:
      severityRaw === "Low" ||
      severityRaw === "Medium" ||
      severityRaw === "High" ||
      severityRaw === "Critical"
        ? severityRaw
        : "",
    likelihood:
      likelihoodRaw && likelihood >= 1 && likelihood <= 5 ? likelihood : null,
    impact: impactRaw && impact >= 1 && impact <= 5 ? impact : null,
    reviewRecency:
      recencyRaw === "never" ||
      recencyRaw === "over365" ||
      recencyRaw === "due"
        ? recencyRaw
        : "",
    uncontrolled: getParam(params, "uncontrolled") === "true",
    categoryId: getParam(params, "category"),
    treatment: RISK_TREATMENTS.includes(treatmentRaw) ? treatmentRaw : "",
    status: RISK_STATUSES.includes(statusRaw as RiskStatus)
      ? (statusRaw as RiskStatus)
      : "",
    assignee: getParam(params, "assignee"),
    appetiteBreach: getParam(params, "appetiteBreach") === "true",
  };
}

export function parseControlFilters(
  params: URLSearchParams,
): ControlListFilters {
  const effectivenessRaw = getParam(params, "effectiveness");
  const isKeyRaw = getParam(params, "isKey");
  const testingStatus = getParam(params, "testingStatus");
  const controlTypeRaw = getParam(params, "controlType");

  return {
    q: getParam(params, "q"),
    effectiveness:
      effectivenessRaw === "effective" ||
      effectivenessRaw === "ineffective" ||
      effectivenessRaw === "not_tested"
        ? effectivenessRaw
        : "",
    testingStatus:
      testingStatus === "Never Tested" ||
      testingStatus === "Tested" ||
      testingStatus === "Overdue"
        ? testingStatus
        : "",
    isKey: isKeyRaw === "true" || isKeyRaw === "false" ? isKeyRaw : "",
    unmapped: getParam(params, "unmapped") === "true",
    categoryId: getParam(params, "category"),
    controlType: CONTROL_TYPES.includes(controlTypeRaw as ControlType)
      ? (controlTypeRaw as ControlType)
      : "",
    assignee: getParam(params, "assignee"),
  };
}

export function parseIncidentFilters(
  params: URLSearchParams,
): IncidentListFilters {
  const severityRaw = getParam(params, "severity");
  const statusRaw = getParam(params, "status");
  const statuses = statusRaw
    ? statusRaw
        .split(",")
        .map((value) => value.trim())
        .filter(
          (value): value is IncidentStatus =>
            value === "open" ||
            value === "investigating" ||
            value === "resolved",
        )
    : [];

  return {
    q: getParam(params, "q"),
    severity:
      severityRaw === "low" ||
      severityRaw === "medium" ||
      severityRaw === "high" ||
      severityRaw === "critical"
        ? severityRaw
        : "",
    status: statuses,
    categoryId: getParam(params, "category"),
    assignee: getParam(params, "assignee"),
  };
}

export function parseIssueFilters(params: URLSearchParams): IssueListFilters {
  const severityRaw = getParam(params, "severity") as IssueSeverity;
  const sourceRaw = getParam(params, "source") as IssueSource;
  const statusRaw = getParam(params, "status");

  const statuses = statusRaw
    ? statusRaw
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is IssueStatus =>
          ISSUE_STATUSES.includes(value as IssueStatus),
        )
    : [];

  return {
    q: getParam(params, "q"),
    severity: ISSUE_SEVERITIES.includes(severityRaw) ? severityRaw : "",
    status: statuses,
    source: ISSUE_SOURCES.includes(sourceRaw) ? sourceRaw : "",
    overdue: getParam(params, "overdue") === "true",
    categoryId: getParam(params, "category"),
    assignee: getParam(params, "assignee"),
  };
}

function matchesAssignee(
  assigneeId: string | null | undefined,
  filter: string,
  myPersonId?: string | null,
) {
  if (!filter) {
    return true;
  }

  if (filter === "unassigned") {
    return !assigneeId;
  }

  if (filter === "me") {
    return Boolean(myPersonId) && assigneeId === myPersonId;
  }

  return assigneeId === filter;
}

export function filterIssues(
  issues: Issue[],
  filters: IssueListFilters,
  context: {
    linkedCategoryIds?: Record<string, string[]>;
    myPersonId?: string | null;
  } = {},
) {
  const query = filters.q.toLowerCase();
  const linkedCategoryIds = context.linkedCategoryIds ?? {};

  return issues.filter((issue) => {
    if (query) {
      const haystack =
        `${issue.title} ${issue.description} ${issue.root_cause} ${issue.remediation_plan}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (filters.severity && issue.severity !== filters.severity) {
      return false;
    }

    if (filters.status.length > 0 && !filters.status.includes(issue.status)) {
      return false;
    }

    if (filters.source && issue.source !== filters.source) {
      return false;
    }

    if (filters.overdue && !isIssueOverdue(issue)) {
      return false;
    }

    if (
      !matchesInheritedCategory(
        linkedCategoryIds[issue.id] ?? [],
        filters.categoryId,
      )
    ) {
      return false;
    }

    if (!matchesAssignee(issue.assignee_id, filters.assignee, context.myPersonId)) {
      return false;
    }

    return true;
  });
}

export function hasActiveFilters(
  values: Record<string, string | number | boolean | null | string[]>,
) {
  return Object.values(values).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "boolean") {
      return value;
    }

    return value !== "" && value !== null;
  });
}

export function filterRisks(
  risks: Risk[],
  filters: RiskListFilters,
  context: {
    lastReviewedByRisk?: Record<string, string>;
    linkedControlCounts?: Record<string, number>;
    categories?: RiskCategory[];
    myPersonId?: string | null;
  } = {},
) {
  const query = filters.q.toLowerCase();
  const lastReviewedByRisk = context.lastReviewedByRisk ?? {};
  const linkedControlCounts = context.linkedControlCounts ?? {};
  const categories = context.categories ?? [];

  return risks.filter((risk) => {
    if (query) {
      const haystack = `${risk.title} ${risk.description}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (filters.severity) {
      const band = getSeverityBand(
        getRiskScore(risk.likelihood, risk.impact),
      );
      if (band !== filters.severity) {
        return false;
      }
    }

    if (filters.likelihood !== null && risk.likelihood !== filters.likelihood) {
      return false;
    }

    if (filters.impact !== null && risk.impact !== filters.impact) {
      return false;
    }

    if (filters.reviewRecency === "due") {
      if (
        !isReviewDue(
          lastReviewedByRisk[risk.id] ?? null,
          risk.likelihood,
          risk.impact,
        )
      ) {
        return false;
      }
    } else if (filters.reviewRecency) {
      const bucket = getReviewRecencyBucket(lastReviewedByRisk[risk.id] ?? null);
      if (bucket !== filters.reviewRecency) {
        return false;
      }
    }

    if (filters.uncontrolled && (linkedControlCounts[risk.id] ?? 0) > 0) {
      return false;
    }

    if (!matchesCategoryFilter(risk.category_id, filters.categoryId)) {
      return false;
    }

    if (
      filters.treatment &&
      (risk.treatment ?? "mitigate") !== filters.treatment
    ) {
      return false;
    }

    if (filters.status && (risk.status ?? "open") !== filters.status) {
      return false;
    }

    if (!matchesAssignee(risk.assignee_id, filters.assignee, context.myPersonId)) {
      return false;
    }

    if (filters.appetiteBreach && !isAppetiteBreach(risk, categories)) {
      return false;
    }

    return true;
  });
}

export function filterControls(
  controls: Control[],
  filters: ControlListFilters,
  context: {
    linkedRiskCounts?: Record<string, number>;
    linkedCategoryIds?: Record<string, string[]>;
    myPersonId?: string | null;
  } = {},
) {
  const query = filters.q.toLowerCase();
  const linkedRiskCounts = context.linkedRiskCounts ?? {};
  const linkedCategoryIds = context.linkedCategoryIds ?? {};

  return controls.filter((control) => {
    if (query) {
      const haystack = `${control.title} ${control.description}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (
      filters.effectiveness &&
      control.effectiveness !== filters.effectiveness
    ) {
      return false;
    }

    if (
      filters.testingStatus &&
      getTestingStatus(control.last_tested_at, control.is_key) !==
        filters.testingStatus
    ) {
      return false;
    }

    if (filters.isKey === "true" && !control.is_key) {
      return false;
    }

    if (filters.isKey === "false" && control.is_key) {
      return false;
    }

    if (filters.unmapped && (linkedRiskCounts[control.id] ?? 0) > 0) {
      return false;
    }

    if (
      !matchesInheritedCategory(
        linkedCategoryIds[control.id] ?? [],
        filters.categoryId,
      )
    ) {
      return false;
    }

    if (
      filters.controlType &&
      (control.control_type ?? "preventive") !== filters.controlType
    ) {
      return false;
    }

    if (
      !matchesAssignee(control.assignee_id, filters.assignee, context.myPersonId)
    ) {
      return false;
    }

    return true;
  });
}

export function filterIncidents(
  incidents: Incident[],
  filters: IncidentListFilters,
  context: {
    linkedCategoryIds?: Record<string, string[]>;
    myPersonId?: string | null;
  } = {},
) {
  const query = filters.q.toLowerCase();
  const linkedCategoryIds = context.linkedCategoryIds ?? {};

  return incidents.filter((incident) => {
    if (query) {
      const haystack =
        `${incident.title} ${incident.description} ${incident.root_cause}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (filters.severity && incident.severity !== filters.severity) {
      return false;
    }

    if (filters.status.length > 0 && !filters.status.includes(incident.status)) {
      return false;
    }

    if (
      !matchesInheritedCategory(
        linkedCategoryIds[incident.id] ?? [],
        filters.categoryId,
      )
    ) {
      return false;
    }

    if (
      !matchesAssignee(
        incident.assignee_id,
        filters.assignee,
        context.myPersonId,
      )
    ) {
      return false;
    }

    return true;
  });
}

export function buildQueryString(
  entries: Record<string, string | number | null | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

const ISSUE_SEVERITY_RANK: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const INCIDENT_SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const INCIDENT_STATUS_RANK: Record<IncidentStatus, number> = {
  open: 0,
  investigating: 1,
  resolved: 2,
};

/** Highest inherent score first so Critical exposure isn't buried under recent Low rows. */
export function sortRisksByExposure(risks: Risk[]) {
  return [...risks].sort((left, right) => {
    const scoreDiff =
      getRiskScore(right.likelihood, right.impact) -
      getRiskScore(left.likelihood, left.impact);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return left.title.localeCompare(right.title);
  });
}

export function sortIssuesByPriority(issues: Issue[]) {
  return [...issues].sort((left, right) => {
    const overdueDiff = Number(isIssueOverdue(right)) - Number(isIssueOverdue(left));
    if (overdueDiff !== 0) {
      return overdueDiff;
    }

    const severityDiff =
      ISSUE_SEVERITY_RANK[left.severity] - ISSUE_SEVERITY_RANK[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return (left.due_date ?? "").localeCompare(right.due_date ?? "");
  });
}

export function sortIncidentsByPriority(incidents: Incident[]) {
  return [...incidents].sort((left, right) => {
    const statusDiff =
      INCIDENT_STATUS_RANK[left.status] - INCIDENT_STATUS_RANK[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const severityDiff =
      INCIDENT_SEVERITY_RANK[left.severity] -
      INCIDENT_SEVERITY_RANK[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return right.date_occurred.localeCompare(left.date_occurred);
  });
}

export function sortControlsByAttention(controls: Control[]) {
  return [...controls].sort((left, right) => {
    const leftOverdue =
      getTestingStatus(left.last_tested_at, left.is_key) === "Overdue";
    const rightOverdue =
      getTestingStatus(right.last_tested_at, right.is_key) === "Overdue";
    const overdueDiff = Number(rightOverdue) - Number(leftOverdue);
    if (overdueDiff !== 0) {
      return overdueDiff;
    }

    const ineffectiveDiff =
      Number(right.effectiveness === "ineffective") -
      Number(left.effectiveness === "ineffective");
    if (ineffectiveDiff !== 0) {
      return ineffectiveDiff;
    }

    const keyDiff = Number(right.is_key) - Number(left.is_key);
    if (keyDiff !== 0) {
      return keyDiff;
    }

    return left.title.localeCompare(right.title);
  });
}
