import { inherentBand, storedResidual } from "@/lib/risk/ratings";
import { isActiveRisk } from "@/lib/taxonomy";
import { isIncidentOpen, type Incident } from "@/lib/types/incident";
import { isIssueOpen, type Issue } from "@/lib/types/issue";
import type { Control } from "@/lib/types/control";
import { isEvidenceExpired, type EvidenceRecord } from "@/lib/types/evidence";
import {
  isObligationActive,
  type ObligationRecord,
} from "@/lib/types/obligation";
import type { Risk } from "@/lib/types/risk";

export type QualitySummary = {
  /** Live completeness 0–100. Not stored. */
  score: number;
  applicable: number;
  flags: string[];
};

export function summarizeQuality(flags: string[], applicable: number): QualitySummary {
  if (applicable <= 0) {
    return { score: 100, applicable: 0, flags: [] };
  }

  const clamped = Math.min(flags.length, applicable);
  return {
    score: Math.round(((applicable - clamped) / applicable) * 100),
    applicable,
    flags,
  };
}

function isHighOrCritical(risk: Pick<Risk, "likelihood" | "impact">) {
  return inherentBand(risk) === "High" || inherentBand(risk) === "Critical";
}

export function riskQuality(
  risk: Pick<
    Risk,
    | "status"
    | "category_id"
    | "assignee_id"
    | "treatment"
    | "treatment_rationale"
    | "likelihood"
    | "impact"
    | "residual_likelihood"
    | "residual_impact"
  >,
  options: {
    controlCount: number;
    hasReview: boolean;
    operatingReady?: boolean;
    enterpriseReady?: boolean;
    residualReady?: boolean;
  },
): QualitySummary {
  if (!isActiveRisk(risk)) {
    return summarizeQuality([], 0);
  }

  const flags: string[] = [];
  let applicable = 2;

  if (!risk.category_id) {
    flags.push("Uncategorised");
  }
  if (options.controlCount === 0) {
    flags.push("No linked controls");
  }

  if (options.enterpriseReady) {
    applicable += 1;
    if (!risk.assignee_id) {
      flags.push("Unassigned");
    }
  }

  if (isHighOrCritical(risk)) {
    applicable += 1;
    if (!options.hasReview) {
      flags.push("High/Critical and never reviewed");
    }
  }

  if (options.residualReady && isActiveRisk(risk)) {
    applicable += 1;
    const residual = storedResidual(risk);
    if (!residual) {
      flags.push("Residual not assessed");
    } else if (
      (residual.likelihood < risk.likelihood || residual.impact < risk.impact) &&
      options.controlCount === 0
    ) {
      flags.push("Residual reduced with no linked controls");
    }
  }

  const treatment = risk.treatment ?? "mitigate";
  if (
    options.operatingReady &&
    (treatment === "accept" || treatment === "transfer")
  ) {
    applicable += 1;
    if (!(risk.treatment_rationale ?? "").trim()) {
      flags.push(
        treatment === "accept"
          ? "Accepted without rationale"
          : "Transferred without rationale",
      );
    }
  }

  return summarizeQuality(flags, applicable);
}

export function controlQuality(
  control: Pick<Control, "assignee_id">,
  options: { mappedToRisk: boolean; enterpriseReady?: boolean },
): QualitySummary {
  const flags: string[] = [];
  let applicable = 1;

  if (!options.mappedToRisk) {
    flags.push("Not mapped to a risk");
  }

  if (options.enterpriseReady) {
    applicable += 1;
    if (!control.assignee_id) {
      flags.push("Unassigned");
    }
  }

  return summarizeQuality(flags, applicable);
}

export function incidentQuality(
  incident: Pick<Incident, "status" | "assignee_id" | "root_cause">,
  options: { enterpriseReady?: boolean },
): QualitySummary {
  const flags: string[] = [];
  let applicable = 0;

  if (options.enterpriseReady && isIncidentOpen(incident.status)) {
    applicable += 1;
    if (!incident.assignee_id) {
      flags.push("Unassigned");
    }
  }

  if (incident.status === "resolved") {
    applicable += 1;
    if (!incident.root_cause.trim()) {
      flags.push("Resolved without root cause");
    }
  }

  return summarizeQuality(flags, applicable);
}

export function issueQuality(
  issue: Pick<Issue, "status" | "assignee_id">,
  options: {
    linkedToRiskOrControl: boolean;
    enterpriseReady?: boolean;
  },
): QualitySummary {
  if (!isIssueOpen(issue.status)) {
    return summarizeQuality([], 0);
  }

  const flags: string[] = [];
  let applicable = 1;

  if (!options.linkedToRiskOrControl) {
    flags.push("Not linked to a risk or control");
  }

  if (options.enterpriseReady) {
    applicable += 1;
    if (!issue.assignee_id) {
      flags.push("Unassigned");
    }
  }

  return summarizeQuality(flags, applicable);
}

export function obligationQuality(
  obligation: Pick<ObligationRecord, "status">,
  options: { mappedToControl: boolean },
): QualitySummary {
  if (!isObligationActive(obligation)) {
    return summarizeQuality([], 0);
  }

  return summarizeQuality(
    options.mappedToControl ? [] : ["No mapped control"],
    1,
  );
}

export function evidenceQuality(
  record: Pick<EvidenceRecord, "retention_date" | "storage_path">,
  options?: { evidenceStorageReady?: boolean },
): QualitySummary {
  const flags: string[] = [];
  let applicable = 1;

  if (isEvidenceExpired(record)) {
    flags.push("Past retention date");
  }

  if (options?.evidenceStorageReady) {
    applicable += 1;
    if (!record.storage_path) {
      flags.push("No file attached");
    }
  }

  return summarizeQuality(flags, applicable);
}
