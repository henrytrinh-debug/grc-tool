import {
  formatIssueStatus,
  type Issue,
  type IssueStatus,
} from "@/lib/types/issue";
import { getActionProgress, type IssueAction } from "@/lib/types/issue-action";

/**
 * Issues advance open -> in_progress -> pending_review -> closed. Closing
 * always goes through review, and a closed issue can only be reopened back
 * into remediation.
 */
const ALLOWED_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress"],
  in_progress: ["open", "pending_review"],
  pending_review: ["in_progress", "closed"],
  closed: ["in_progress"],
};

const TRANSITION_LABELS: Record<string, string> = {
  "open>in_progress": "Start Remediation",
  "in_progress>open": "Move Back to Open",
  "in_progress>pending_review": "Submit for Review",
  "pending_review>in_progress": "Return to Remediation",
  "pending_review>closed": "Close Issue",
  "closed>in_progress": "Reopen Issue",
};

export type TransitionOption = {
  to: IssueStatus;
  label: string;
  blockers: string[];
  allowed: boolean;
};

export function getTransitionLabel(from: IssueStatus, to: IssueStatus) {
  return (
    TRANSITION_LABELS[`${from}>${to}`] ?? `Move to ${formatIssueStatus(to)}`
  );
}

/**
 * Human-readable reasons a transition cannot happen yet. Empty means allowed.
 */
export function getTransitionBlockers(
  issue: Issue,
  actions: IssueAction[],
  to: IssueStatus,
): string[] {
  const blockers: string[] = [];

  if (to === "pending_review") {
    const progress = getActionProgress(actions);

    if (!issue.remediation_plan.trim()) {
      blockers.push("A remediation plan is required before review.");
    }

    if (progress.total === 0) {
      blockers.push("Add at least one action item before review.");
    } else if (progress.completed < progress.total) {
      const remaining = progress.total - progress.completed;
      blockers.push(
        `${remaining} action item${remaining === 1 ? "" : "s"} still outstanding.`,
      );
    }
  }

  if (to === "closed") {
    if (!issue.root_cause.trim()) {
      blockers.push("A root cause is required before closing.");
    }

    if (!issue.closure_notes.trim()) {
      blockers.push("Closure notes are required before closing.");
    }
  }

  return blockers;
}

export function getAvailableTransitions(
  issue: Issue,
  actions: IssueAction[],
): TransitionOption[] {
  return ALLOWED_TRANSITIONS[issue.status].map((to) => {
    const blockers = getTransitionBlockers(issue, actions, to);

    return {
      to,
      label: getTransitionLabel(issue.status, to),
      blockers,
      allowed: blockers.length === 0,
    };
  });
}

/**
 * Extra column writes that accompany a status change.
 */
export function getTransitionPatch(to: IssueStatus) {
  if (to === "closed") {
    return { status: to, closed_at: new Date().toISOString() };
  }

  return { status: to, closed_at: null };
}

export function describeTransition(from: IssueStatus, to: IssueStatus) {
  return `Status changed from ${formatIssueStatus(from)} to ${formatIssueStatus(to)}.`;
}

export const ISSUE_WORKFLOW_STAGES: IssueStatus[] = [
  "open",
  "in_progress",
  "pending_review",
  "closed",
];
