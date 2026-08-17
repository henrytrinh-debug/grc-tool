import type { IncidentEvent, RiskEvent } from "@/lib/governance/events";
import type { EntityComment } from "@/lib/types/entity-comment";
import type { FollowUp } from "@/lib/types/follow-up";
import type { ControlTestResult } from "@/lib/types/control-test-result";
import type { IssueComment } from "@/lib/types/issue-comment";
import type { RcsaReview } from "@/lib/types/rcsa";
import { entityHref } from "@/lib/types/follow-up";

export type AuditEntry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  href: string;
  source: string;
};

function push(
  entries: AuditEntry[],
  entry: AuditEntry,
) {
  entries.push(entry);
}

export function buildAuditTrail(input: {
  riskEvents?: RiskEvent[];
  incidentEvents?: IncidentEvent[];
  comments?: EntityComment[];
  issueComments?: IssueComment[];
  reviews?: Array<
    Pick<RcsaReview, "id" | "risk_id" | "reviewed_at" | "previous_likelihood" | "previous_impact" | "final_likelihood" | "final_impact">
  >;
  tests?: ControlTestResult[];
  followUps?: FollowUp[];
  titles?: Record<string, string>;
}): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const titleOf = (id: string) => input.titles?.[id] ?? "Record";

  for (const event of input.riskEvents ?? []) {
    push(entries, {
      id: `risk-event-${event.id}`,
      at: event.created_at,
      title: titleOf(event.risk_id),
      detail: `${event.field.replaceAll("_", " ")}: ${event.previous_value || "—"} → ${event.next_value || "—"}`,
      href: entityHref("risk", event.risk_id),
      source: "Risk change",
    });
  }

  for (const event of input.incidentEvents ?? []) {
    push(entries, {
      id: `incident-event-${event.id}`,
      at: event.created_at,
      title: titleOf(event.incident_id),
      detail: `${event.field.replaceAll("_", " ")}: ${event.previous_value || "—"} → ${event.next_value || "—"}`,
      href: entityHref("incident", event.incident_id),
      source: "Incident change",
    });
  }

  for (const comment of input.comments ?? []) {
    if (comment.entity_type === "follow_up") {
      continue;
    }
    push(entries, {
      id: `comment-${comment.id}`,
      at: comment.created_at,
      title: titleOf(comment.entity_id),
      detail: comment.body,
      href: entityHref(comment.entity_type, comment.entity_id),
      source: comment.kind === "status_change" ? "Status note" : "Comment",
    });
  }

  for (const comment of input.issueComments ?? []) {
    push(entries, {
      id: `issue-comment-${comment.id}`,
      at: comment.created_at,
      title: titleOf(comment.issue_id),
      detail: comment.body,
      href: entityHref("issue", comment.issue_id),
      source: comment.kind === "status_change" ? "Issue status" : "Issue note",
    });
  }

  for (const review of input.reviews ?? []) {
    push(entries, {
      id: `review-${review.id}`,
      at: review.reviewed_at,
      title: titleOf(review.risk_id),
      detail: `RCSA ${review.previous_likelihood}×${review.previous_impact} → ${review.final_likelihood}×${review.final_impact}`,
      href: entityHref("risk", review.risk_id),
      source: "Risk assessment",
    });
  }

  for (const test of input.tests ?? []) {
    push(entries, {
      id: `test-${test.id}`,
      at: `${test.tested_at}T00:00:00.000Z`,
      title: titleOf(test.control_id),
      detail: `Test recorded as ${test.effectiveness}${test.notes ? ` · ${test.notes}` : ""}`,
      href: entityHref("control", test.control_id),
      source: "Control test",
    });
  }

  for (const followUp of input.followUps ?? []) {
    push(entries, {
      id: `follow-up-${followUp.id}`,
      at: followUp.created_at ?? new Date().toISOString(),
      title: followUp.title,
      detail: `${followUp.trigger_type.replaceAll("_", " ")} · ${followUp.status}`,
      href: `/feedback?focus=${followUp.id}`,
      source: "Follow-up",
    });
  }

  return entries.sort((left, right) => right.at.localeCompare(left.at));
}
