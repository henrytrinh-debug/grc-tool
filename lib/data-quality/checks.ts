import { highCriticalRisks } from "@/lib/metrics/kpis";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
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

export type QualityFinding = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
  items: QualityItem[];
};

function finding(
  id: string,
  title: string,
  description: string,
  href: string,
  items: QualityItem[],
): QualityFinding {
  return { id, title, description, href, count: items.length, items };
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

  const findings: QualityFinding[] = [
    finding(
      "uncategorised-risks",
      "Uncategorised active risks",
      "Open or monitoring risks with no taxonomy category.",
      "/risks?category=uncategorised",
      uncategorised,
    ),
    finding(
      "high-critical-never-reviewed",
      "High/Critical risks never reviewed",
      "Top-band exposure with no RCSA review on record.",
      "/risks?severity=High,Critical&reviewRecency=never",
      neverReviewedHigh,
    ),
    finding(
      "risks-without-controls",
      "Risks without controls",
      "Active risks with no linked control.",
      "/risks?uncontrolled=true",
      withoutControls,
    ),
    finding(
      "controls-without-risks",
      "Controls without risks",
      "Controls that are not mapped to any risk.",
      "/controls?unmapped=true",
      orphanControls,
    ),
    finding(
      "unassigned-active",
      "Unassigned active records",
      "Active risks, controls, open incidents, and open issues with no accountable person.",
      "/risks?assignee=unassigned",
      unassigned,
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

    findings.push(
      finding(
        "obligation-coverage-gaps",
        "Obligations without mapped controls",
        "Active obligations that are not linked to any control.",
        "/obligations",
        uncovered,
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
      ),
      finding(
        "missing-evidence-files",
        "Evidence without an attached file",
        "Metadata records that have no stored object. Upload is optional until Storage is configured.",
        "/evidence",
        missingFile,
      ),
    );
  }

  return findings;
}
