import {
  getRiskScore,
  getSeverityBand,
  type SeverityBand,
} from "@/lib/dashboard/analytics";
import {
  getTestingStatus,
  type Control,
  type Effectiveness,
} from "@/lib/types/control";
import type { Incident, IncidentStatus, Severity } from "@/lib/types/incident";
import type { Risk } from "@/lib/types/risk";

export type RiskListFilters = {
  q: string;
  severity: SeverityBand | "";
  likelihood: number | null;
  impact: number | null;
};

export type ControlListFilters = {
  q: string;
  effectiveness: Effectiveness | "";
  testingStatus: string;
  isKey: "" | "true" | "false";
};

export type IncidentListFilters = {
  q: string;
  severity: Severity | "";
  status: IncidentStatus[];
};

function getParam(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? "";
}

export function parseRiskFilters(params: URLSearchParams): RiskListFilters {
  const likelihoodRaw = getParam(params, "likelihood");
  const impactRaw = getParam(params, "impact");
  const severityRaw = getParam(params, "severity");
  const likelihood = Number(likelihoodRaw);
  const impact = Number(impactRaw);

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
  };
}

export function parseControlFilters(
  params: URLSearchParams,
): ControlListFilters {
  const effectivenessRaw = getParam(params, "effectiveness");
  const isKeyRaw = getParam(params, "isKey");
  const testingStatus = getParam(params, "testingStatus");

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
  };
}

export function hasActiveFilters(
  values: Record<string, string | number | null | string[]>,
) {
  return Object.values(values).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== "" && value !== null;
  });
}

export function filterRisks(risks: Risk[], filters: RiskListFilters) {
  const query = filters.q.toLowerCase();

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

    return true;
  });
}

export function filterControls(
  controls: Control[],
  filters: ControlListFilters,
) {
  const query = filters.q.toLowerCase();

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
      getTestingStatus(control.last_tested_at) !== filters.testingStatus
    ) {
      return false;
    }

    if (filters.isKey === "true" && !control.is_key) {
      return false;
    }

    if (filters.isKey === "false" && control.is_key) {
      return false;
    }

    return true;
  });
}

export function filterIncidents(
  incidents: Incident[],
  filters: IncidentListFilters,
) {
  const query = filters.q.toLowerCase();

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
