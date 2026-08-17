import { formatIsoDate, parseIsoDate } from "@/lib/dates";
import { formatEffectiveness, type Control } from "@/lib/types/control";
import type { ControlTestResult } from "@/lib/types/control-test-result";
import { formatIncidentStatus, type Incident } from "@/lib/types/incident";
import { formatIssueStatus, type Issue } from "@/lib/types/issue";
import type { IssueComment } from "@/lib/types/issue-comment";
import type { RcsaReview } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";
import type { IncidentEvent, RiskEvent } from "@/lib/governance/events";

export type ActivityKind =
  | "review"
  | "test"
  | "issue_note"
  | "issue_status"
  | "incident"
  | "issue"
  | "risk_event"
  | "incident_event";

export type ActivityItem = {
  id: string;
  at: string;
  href: string;
  title: string;
  detail: string;
  kind: ActivityKind;
};

const KIND_LABEL: Record<ActivityKind, string> = {
  review: "RCSA",
  test: "Test",
  issue_note: "Issue note",
  issue_status: "Issue status",
  incident: "Incident",
  issue: "Issue raised",
  risk_event: "Risk change",
  incident_event: "Incident change",
};

export function formatActivityKind(kind: ActivityKind) {
  return KIND_LABEL[kind];
}

export function buildActivityFeed(input: {
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
  reviews: RcsaReview[];
  tests: ControlTestResult[];
  comments: IssueComment[];
  riskEvents?: RiskEvent[];
  incidentEvents?: IncidentEvent[];
  limit?: number;
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  const riskTitle = new Map(input.risks.map((risk) => [risk.id, risk.title]));
  const controlTitle = new Map(
    input.controls.map((control) => [control.id, control.title]),
  );
  const issueTitle = new Map(input.issues.map((issue) => [issue.id, issue.title]));
  const incidentTitle = new Map(
    input.incidents.map((incident) => [incident.id, incident.title]),
  );
  const issueIdsWithActivity = new Set(
    input.comments.map((comment) => comment.issue_id),
  );

  for (const review of input.reviews) {
    items.push({
      id: `review-${review.id}`,
      at: review.reviewed_at,
      href: `/risks/${review.risk_id}/edit`,
      title: riskTitle.get(review.risk_id) ?? "Risk review",
      detail: `Reviewed ${review.previous_likelihood}×${review.previous_impact} → ${review.final_likelihood}×${review.final_impact}`,
      kind: "review",
    });
  }

  for (const test of input.tests) {
    items.push({
      id: `test-${test.id}`,
      at: test.created_at ?? test.tested_at,
      href: `/controls/${test.control_id}/edit`,
      title: controlTitle.get(test.control_id) ?? "Control test",
      detail: `${formatEffectiveness(test.effectiveness)} · ${formatIsoDate(test.tested_at)}`,
      kind: "test",
    });
  }

  for (const comment of input.comments) {
    items.push({
      id: `comment-${comment.id}`,
      at: comment.created_at,
      href: `/issues/${comment.issue_id}/edit`,
      title: issueTitle.get(comment.issue_id) ?? "Issue activity",
      detail:
        comment.kind === "status_change"
          ? comment.body
          : `Note: ${comment.body.slice(0, 80)}`,
      kind: comment.kind === "status_change" ? "issue_status" : "issue_note",
    });
  }

  for (const event of input.riskEvents ?? []) {
    items.push({
      id: `risk-event-${event.id}`,
      at: event.created_at,
      href: `/risks/${event.risk_id}/edit`,
      title: riskTitle.get(event.risk_id) ?? "Risk change",
      detail: `${event.field} ${event.previous_value || "—"} → ${event.next_value || "—"}`,
      kind: "risk_event",
    });
  }

  for (const event of input.incidentEvents ?? []) {
    items.push({
      id: `incident-event-${event.id}`,
      at: event.created_at,
      href: `/incidents/${event.incident_id}/edit`,
      title: incidentTitle.get(event.incident_id) ?? "Incident change",
      detail: `${event.field} ${event.previous_value || "—"} → ${event.next_value || "—"}`,
      kind: "incident_event",
    });
  }

  for (const incident of input.incidents) {
    items.push({
      id: `incident-${incident.id}`,
      at: incident.created_at ?? incident.date_occurred,
      href: `/incidents/${incident.id}/edit`,
      title: incident.title,
      detail: `${formatIncidentStatus(incident.status)} · occurred ${formatIsoDate(incident.date_occurred)}`,
      kind: "incident",
    });
  }

  for (const issue of input.issues) {
    // New issues write an "Issue raised" status event. Only synthesize a
    // creation row for legacy/imported issues without any activity rows.
    if (issueIdsWithActivity.has(issue.id)) {
      continue;
    }

    items.push({
      id: `issue-${issue.id}`,
      at: issue.created_at ?? issue.identified_at,
      href: `/issues/${issue.id}/edit`,
      title: issue.title,
      detail: `${formatIssueStatus(issue.status)} · identified ${formatIsoDate(issue.identified_at)}`,
      kind: "issue",
    });
  }

  const limit = input.limit ?? 16;
  return items
    .sort(
      (left, right) =>
        parseIsoDate(right.at).getTime() - parseIsoDate(left.at).getTime(),
    )
    .slice(0, limit);
}
