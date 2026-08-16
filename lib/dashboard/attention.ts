import {
  getRiskScore,
  getSeverityBand,
} from "@/lib/dashboard/analytics";
import { getTestingStatus, type Control } from "@/lib/types/control";
import { formatIncidentStatus, isIncidentOpen, type Incident } from "@/lib/types/incident";
import {
  formatIssueSeverity,
  isIssueOverdue,
  type Issue,
} from "@/lib/types/issue";
import { isReviewDue } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

export type AttentionTone = "alert" | "watch";

export type AttentionItem = {
  id: string;
  href: string;
  title: string;
  reason: string;
  tone: AttentionTone;
};

const MAX_ITEMS = 8;

function isHighOrCriticalBand(likelihood: number, impact: number) {
  const band = getSeverityBand(getRiskScore(likelihood, impact));
  return band === "High" || band === "Critical";
}

/**
 * Operational "what needs a look today" queue for the home dashboard.
 * Ordered so overdue findings, failed key controls, and High/Critical
 * register gaps surface first.
 */
export function buildAttentionItems(
  controls: Control[],
  incidents: Incident[],
  issues: Issue[],
  risks: Risk[] = [],
  context: {
    lastReviewedByRisk?: Record<string, string>;
    linkedControlCounts?: Record<string, number>;
  } = {},
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const lastReviewedByRisk = context.lastReviewedByRisk ?? {};
  const linkedControlCounts = context.linkedControlCounts ?? {};

  for (const issue of issues) {
    if (!isIssueOverdue(issue)) {
      continue;
    }

    items.push({
      id: `issue-${issue.id}`,
      href: `/issues/${issue.id}/edit`,
      title: issue.title,
      reason: `Overdue ${formatIssueSeverity(issue.severity).toLowerCase()} issue`,
      tone:
        issue.severity === "critical" || issue.severity === "high"
          ? "alert"
          : "watch",
    });
  }

  for (const control of controls) {
    if (control.is_key && control.effectiveness === "ineffective") {
      items.push({
        id: `control-ineffective-${control.id}`,
        href: `/controls/${control.id}/edit`,
        title: control.title,
        reason: "Key control rated ineffective",
        tone: "alert",
      });
    }

    if (getTestingStatus(control.last_tested_at, control.is_key) === "Overdue") {
      items.push({
        id: `control-overdue-${control.id}`,
        href: `/controls/${control.id}/edit`,
        title: control.title,
        reason: control.is_key
          ? "Key control testing overdue"
          : "Control testing overdue",
        tone: control.is_key ? "alert" : "watch",
      });
    }
  }

  for (const incident of incidents) {
    if (
      !isIncidentOpen(incident.status) ||
      (incident.severity !== "critical" && incident.severity !== "high")
    ) {
      continue;
    }

    items.push({
      id: `incident-${incident.id}`,
      href: `/incidents/${incident.id}/edit`,
      title: incident.title,
      reason: `${incident.severity === "critical" ? "Critical" : "High"} incident still ${formatIncidentStatus(incident.status).toLowerCase()}`,
      tone: incident.severity === "critical" ? "alert" : "watch",
    });
  }

  for (const risk of risks) {
    if (!isHighOrCriticalBand(risk.likelihood, risk.impact)) {
      continue;
    }

    const band = getSeverityBand(
      getRiskScore(risk.likelihood, risk.impact),
    );
    const lastReviewedAt = lastReviewedByRisk[risk.id] ?? null;
    const controlCount = linkedControlCounts[risk.id] ?? 0;

    if (controlCount === 0) {
      items.push({
        id: `risk-uncontrolled-${risk.id}`,
        href: `/risks/${risk.id}/edit`,
        title: risk.title,
        reason: `Uncontrolled ${band.toLowerCase()} risk`,
        tone: "alert",
      });
    }

    if (isReviewDue(lastReviewedAt, risk.likelihood, risk.impact)) {
      items.push({
        id: `risk-review-${risk.id}`,
        href: `/rcsa/review?risk=${risk.id}`,
        title: risk.title,
        reason: lastReviewedAt
          ? `${band} risk past its ${band === "Critical" ? "90" : "180"}-day review cadence`
          : `${band} risk has never been reviewed`,
        tone: band === "Critical" ? "alert" : "watch",
      });
    }
  }

  items.sort((left, right) => {
    if (left.tone === right.tone) {
      return left.title.localeCompare(right.title);
    }

    return left.tone === "alert" ? -1 : 1;
  });

  return items.slice(0, MAX_ITEMS);
}
