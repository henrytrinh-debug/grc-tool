import { highCriticalRisks } from "@/lib/metrics/kpis";
import { storedResidual } from "@/lib/risk/ratings";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { isReviewDue } from "@/lib/types/rcsa";
import { todayIsoDate } from "@/lib/dates";
import { isActiveRisk } from "@/lib/taxonomy";
import { isIncidentOpen, type Incident } from "@/lib/types/incident";
import { isIssueOpen, type Issue } from "@/lib/types/issue";
import type { Control } from "@/lib/types/control";
import type { EvidenceRecord } from "@/lib/types/evidence";
import { isEvidenceExpired } from "@/lib/types/evidence";
import {
  isObligationActive,
  type ObligationRecord,
} from "@/lib/types/obligation";
import type { Risk } from "@/lib/types/risk";
import {
  controlQuality,
  evidenceQuality,
  incidentQuality,
  issueQuality,
  obligationQuality,
  riskQuality,
  summarizeQuality,
} from "@/lib/data-quality/record";
import type {
  IssueControlLink,
  IssueRiskLink,
  RiskControlLink,
  SnapshotIndexes,
} from "@/lib/snapshot/grc-snapshot";

export type QualityItem = {
  id: string;
  title: string;
  href: string;
};

export type QualityRegister =
  | "risks"
  | "controls"
  | "incidents"
  | "issues"
  | "obligations"
  | "evidence"
  | "cross";

export const QUALITY_REGISTER_ORDER: QualityRegister[] = [
  "risks",
  "controls",
  "incidents",
  "issues",
  "obligations",
  "evidence",
  "cross",
];

export const QUALITY_REGISTER_LABELS: Record<QualityRegister, string> = {
  risks: "Risks",
  controls: "Controls",
  incidents: "Incidents",
  issues: "Issues",
  obligations: "Obligations",
  evidence: "Evidence",
  cross: "Cross-register",
};

export function groupQualityFindings(findings: QualityFinding[]) {
  return QUALITY_REGISTER_ORDER.map((register) => ({
    register,
    label: QUALITY_REGISTER_LABELS[register],
    findings: findings.filter((finding) => finding.register === register),
  })).filter((group) => group.findings.length > 0);
}

export type QualityFinding = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
  items: QualityItem[];
  register: QualityRegister;
  severity: QualitySeverity;
};

export type QualitySeverity = "blocker" | "gap";

function finding(
  id: string,
  title: string,
  description: string,
  href: string,
  items: QualityItem[],
  register: QualityRegister,
  severity: QualitySeverity = "gap",
): QualityFinding {
  return {
    id,
    title,
    description,
    href,
    count: items.length,
    items,
    register,
    severity,
  };
}

export function groupQualityBySeverity(findings: QualityFinding[]) {
  return {
    blockers: findings.filter(
      (item) => item.severity === "blocker" && item.count > 0,
    ),
    gaps: findings.filter((item) => item.severity === "gap" && item.count > 0),
  };
}

function riskHref(id: string) {
  return `/risks/${id}/edit`;
}

export function buildQualityFindings(input: {
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
  indexes: SnapshotIndexes;
  riskControlLinks: RiskControlLink[];
  issueRiskLinks: IssueRiskLink[];
  issueControlLinks: IssueControlLink[];
  operatingReady?: boolean;
  residualReady?: boolean;
  obligations?: ObligationRecord[];
  obligationControlLinks?: Array<{ obligation_id: string; control_id: string }>;
  evidence?: EvidenceRecord[];
}): QualityFinding[] {
  const lastReviewed = input.indexes.lastReviewedByRisk;
  const linkedControls = input.indexes.linkedControlCountsByRisk;
  const issuesWithRisks = new Set(input.issueRiskLinks.map((link) => link.issue_id));
  const issuesWithControls = new Set(
    input.issueControlLinks.map((link) => link.issue_id),
  );
  const controlsWithRisks = new Set(
    input.riskControlLinks.map((link) => link.control_id),
  );

  const uncategorised = input.risks
    .filter((risk) => isActiveRisk(risk) && !risk.category_id)
    .map((risk) => ({
      id: risk.id,
      title: risk.title,
      href: riskHref(risk.id),
    }));

  const neverReviewedHigh = highCriticalRisks(input.risks)
    .filter((risk) => !lastReviewed[risk.id])
    .map((risk) => ({
      id: risk.id,
      title: `${risk.title} · ${getSeverityBand(getRiskScore(risk.likelihood, risk.impact))}`,
      href: riskHref(risk.id),
    }));

  const withoutControls = input.risks
    .filter((risk) => isActiveRisk(risk) && (linkedControls[risk.id] ?? 0) === 0)
    .map((risk) => ({
      id: risk.id,
      title: risk.title,
      href: riskHref(risk.id),
    }));

  const orphanControls = input.controls
    .filter((control) => !controlsWithRisks.has(control.id))
    .map((control) => ({
      id: control.id,
      title: control.title,
      href: `/controls/${control.id}/edit`,
    }));

  const unassigned: QualityItem[] = [
    ...input.risks
      .filter((risk) => isActiveRisk(risk) && !risk.assignee_id)
      .map((risk) => ({
        id: `risk-${risk.id}`,
        title: `Risk · ${risk.title}`,
        href: riskHref(risk.id),
      })),
    ...input.controls
      .filter((control) => !control.assignee_id)
      .map((control) => ({
        id: `control-${control.id}`,
        title: `Control · ${control.title}`,
        href: `/controls/${control.id}/edit`,
      })),
    ...input.incidents
      .filter((incident) => isIncidentOpen(incident.status) && !incident.assignee_id)
      .map((incident) => ({
        id: `incident-${incident.id}`,
        title: `Incident · ${incident.title}`,
        href: `/incidents/${incident.id}/edit`,
      })),
    ...input.issues
      .filter((issue) => isIssueOpen(issue.status) && !issue.assignee_id)
      .map((issue) => ({
        id: `issue-${issue.id}`,
        title: `Issue · ${issue.title}`,
        href: `/issues/${issue.id}/edit`,
      })),
  ];

  const dueReviews = input.risks
    .filter((risk) =>
      isActiveRisk(risk) &&
      isReviewDue(
        lastReviewed[risk.id] ?? null,
        risk.likelihood,
        risk.impact,
      ),
    )
    .map((risk) => ({
      id: risk.id,
      title: risk.title,
      href: riskHref(risk.id),
    }));

  const findings: QualityFinding[] = [
    finding(
      "uncategorised-risks",
      "Uncategorised active risks",
      "Open or monitoring risks with no taxonomy category.",
      "/risks?category=uncategorised",
      uncategorised,
      "risks",
    ),
    finding(
      "high-critical-never-reviewed",
      "High/Critical risks never reviewed",
      "Top-band exposure with no RCSA review on record.",
      "/risks?severity=High,Critical&reviewRecency=never",
      neverReviewedHigh,
      "risks",
      "blocker",
    ),
    finding(
      "reviews-due",
      "Risks due for review",
      "Active risks past the configured review cadence for their score band.",
      "/risks?reviewRecency=due",
      dueReviews,
      "risks",
    ),
    finding(
      "risks-without-controls",
      "Risks without controls",
      "Active risks with no linked control.",
      "/risks?uncontrolled=true",
      withoutControls,
      "risks",
    ),
    finding(
      "controls-without-risks",
      "Controls without risks",
      "Controls that are not mapped to any risk.",
      "/controls?unmapped=true",
      orphanControls,
      "controls",
    ),
    finding(
      "unassigned-active",
      "Unassigned active records",
      "Active risks, controls, open incidents, and open issues with no accountable person.",
      "/risks?assignee=unassigned",
      unassigned,
      "cross",
    ),
  ];

  if (input.operatingReady) {
    const missingRationale = input.risks
      .filter((risk) => {
        const treatment = risk.treatment ?? "mitigate";
        return (
          isActiveRisk(risk) &&
          (treatment === "accept" || treatment === "transfer") &&
          !(risk.treatment_rationale ?? "").trim()
        );
      })
      .map((risk) => ({
        id: risk.id,
        title: `${risk.title} · ${risk.treatment}`,
        href: riskHref(risk.id),
      }));

    findings.push(
      finding(
        "treatment-without-rationale",
        "Accept/transfer treatments without rationale",
        "Active accepted or transferred risks that do not record why.",
        "/risks",
        missingRationale,
        "risks",
        "blocker",
      ),
    );
  }

  if (input.residualReady) {
    const unassessedResidual = input.risks
      .filter((risk) => isActiveRisk(risk) && !storedResidual(risk))
      .map((risk) => ({
        id: risk.id,
        title: risk.title,
        href: riskHref(risk.id),
      }));

    findings.push(
      finding(
        "residual-unassessed",
        "Residual rating not assessed",
        "Active risks still have inherent only. Confirm residual in Risk Assessment after reviewing controls.",
        "/risks?residualUnassessed=true",
        unassessedResidual,
        "risks",
      ),
    );

    const residualWithoutControls = input.risks
      .filter((risk) => {
        if (!isActiveRisk(risk)) {
          return false;
        }
        const residual = storedResidual(risk);
        if (!residual) {
          return false;
        }
        const reduced =
          residual.likelihood < risk.likelihood || residual.impact < risk.impact;
        return reduced && (linkedControls[risk.id] ?? 0) === 0;
      })
      .map((risk) => ({
        id: risk.id,
        title: risk.title,
        href: riskHref(risk.id),
      }));

    findings.push(
      finding(
        "residual-without-controls",
        "Residual reduced with no linked controls",
        "Net rating sits below inherent but the risk has no mapped controls. Link a control or set residual equal to inherent.",
        "/risks?uncontrolled=true",
        residualWithoutControls,
        "risks",
        "blocker",
      ),
    );
  }

  const resolvedNoCause = input.incidents
    .filter(
      (incident) =>
        incident.status === "resolved" && !incident.root_cause.trim(),
    )
    .map((incident) => ({
      id: incident.id,
      title: incident.title,
      href: `/incidents/${incident.id}/edit`,
    }));

  findings.push(
    finding(
      "resolved-without-root-cause",
      "Resolved incidents without root cause",
      "Closed incidents that never recorded why they happened.",
      "/incidents?status=resolved",
      resolvedNoCause,
      "incidents",
      "blocker",
    ),
  );

  const openUnlinkedIssues = input.issues
    .filter(
      (issue) =>
        isIssueOpen(issue.status) &&
        !issuesWithRisks.has(issue.id) &&
        !issuesWithControls.has(issue.id),
    )
    .map((issue) => ({
      id: issue.id,
      title: issue.title,
      href: `/issues/${issue.id}/edit`,
    }));

  findings.push(
    finding(
      "open-issues-unlinked",
      "Open issues without linked risks or controls",
      "Findings in flight that are not mapped to a risk or control.",
      `/issues?status=open,in_progress,pending_review`,
      openUnlinkedIssues,
      "issues",
    ),
  );

  const obligations = input.obligations ?? [];
  if (obligations.length > 0 || input.obligations) {
    const covered = new Set(
      (input.obligationControlLinks ?? []).map((link) => link.obligation_id),
    );
    const uncovered = obligations
      .filter((obligation) => isObligationActive(obligation) && !covered.has(obligation.id))
      .map((obligation) => ({
        id: obligation.id,
        title: obligation.title,
        href: `/obligations/${obligation.id}/edit`,
      }));

    const overdueReviews = obligations
      .filter(
        (obligation) =>
          isObligationActive(obligation) &&
          Boolean(obligation.review_date) &&
          (obligation.review_date as string) < todayIsoDate(),
      )
      .map((obligation) => ({
        id: obligation.id,
        title: obligation.title,
        href: `/obligations/${obligation.id}/edit`,
      }));

    findings.push(
      finding(
        "obligation-coverage-gaps",
        "Obligations without mapped controls",
        "Active obligations that are not linked to any control.",
        "/obligations",
        uncovered,
        "obligations",
      ),
      finding(
        "obligation-reviews-overdue",
        "Obligations past review date",
        "Active obligations whose next review date is in the past.",
        "/obligations",
        overdueReviews,
        "obligations",
      ),
    );
  }

  const evidence = input.evidence ?? [];
  if (evidence.length > 0 || input.evidence) {
    const expired = evidence
      .filter((row) => isEvidenceExpired(row))
      .map((row) => ({
        id: row.id,
        title: row.title,
        href: `/evidence/${row.id}/edit`,
      }));
    const missingFile = evidence
      .filter((row) => !row.storage_path)
      .map((row) => ({
        id: row.id,
        title: row.title,
        href: `/evidence/${row.id}/edit`,
      }));

    findings.push(
      finding(
        "expired-evidence",
        "Expired evidence",
        "Evidence past its retention date.",
        "/evidence?expired=true",
        expired,
        "evidence",
        "blocker",
      ),
      finding(
        "missing-evidence-files",
        "Evidence without an attached file",
        "Metadata records that have no stored object. Upload is optional until Storage is configured.",
        "/evidence",
        missingFile,
        "evidence",
      ),
    );
  }

  return findings;
}

export type RegisterQualityScore = {
  id: QualityRegister;
  label: string;
  href: string;
  score: number;
  flagged: number;
  records: number;
};

export function buildRegisterQualityScores(
  input: Parameters<typeof buildQualityFindings>[0] & {
    enterpriseReady?: boolean;
    evidenceStorageReady?: boolean;
  },
): RegisterQualityScore[] {
  const lastReviewed = input.indexes.lastReviewedByRisk;
  const linkedControls = input.indexes.linkedControlCountsByRisk;
  const issuesWithRisks = new Set(input.issueRiskLinks.map((link) => link.issue_id));
  const issuesWithControls = new Set(
    input.issueControlLinks.map((link) => link.issue_id),
  );
  const controlsWithRisks = new Set(
    input.riskControlLinks.map((link) => link.control_id),
  );
  const obligationCovered = new Set(
    (input.obligationControlLinks ?? []).map((link) => link.obligation_id),
  );

  function rollup(
    id: QualityRegister,
    label: string,
    href: string,
    summaries: Array<{ flags: string[]; applicable: number }>,
  ): RegisterQualityScore {
    const applicable = summaries.reduce((sum, item) => sum + item.applicable, 0);
    const flagged = summaries.reduce((sum, item) => sum + item.flags.length, 0);
    const summary = summarizeQuality(
      Array.from({ length: flagged }, () => "flag"),
      applicable,
    );
    return {
      id,
      label,
      href,
      score: applicable === 0 ? 100 : summary.score,
      flagged,
      records: summaries.length,
    };
  }

  return [
    rollup(
      "risks",
      "Risks",
      "/risks?view=summary",
      input.risks.filter(isActiveRisk).map((risk) =>
        riskQuality(risk, {
          controlCount: linkedControls[risk.id] ?? 0,
          hasReview: Boolean(lastReviewed[risk.id]),
          operatingReady: input.operatingReady,
          enterpriseReady: input.enterpriseReady,
          residualReady: input.residualReady,
        }),
      ),
    ),
    rollup(
      "controls",
      "Controls",
      "/controls?view=summary",
      input.controls.map((control) =>
        controlQuality(control, {
          mappedToRisk: controlsWithRisks.has(control.id),
          enterpriseReady: input.enterpriseReady,
        }),
      ),
    ),
    rollup(
      "incidents",
      "Incidents",
      "/incidents?view=summary",
      input.incidents.map((incident) =>
        incidentQuality(incident, { enterpriseReady: input.enterpriseReady }),
      ),
    ),
    rollup(
      "issues",
      "Issues",
      "/issues?view=summary",
      input.issues.map((issue) =>
        issueQuality(issue, {
          linkedToRiskOrControl:
            issuesWithRisks.has(issue.id) || issuesWithControls.has(issue.id),
          enterpriseReady: input.enterpriseReady,
        }),
      ),
    ),
    ...(input.obligations
      ? [
          rollup(
            "obligations",
            "Obligations",
            "/obligations?view=summary",
            input.obligations.map((obligation) =>
              obligationQuality(obligation, {
                mappedToControl: obligationCovered.has(obligation.id),
              }),
            ),
          ),
        ]
      : []),
    ...(input.evidence
      ? [
          rollup(
            "evidence",
            "Evidence",
            "/evidence?view=summary",
            input.evidence.map((row) =>
              evidenceQuality(row, {
                evidenceStorageReady: input.evidenceStorageReady,
              }),
            ),
          ),
        ]
      : []),
  ];
}
