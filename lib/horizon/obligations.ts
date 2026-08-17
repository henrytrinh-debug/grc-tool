import { daysUntilIsoDate, formatIsoDate } from "@/lib/dates";
import { isActiveRisk } from "@/lib/taxonomy";
import {
  getNextTestDueDate,
  isTestingDue,
  type Control,
} from "@/lib/types/control";
import { isIssueOpen, isIssueOverdue, type Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";
import {
  formatPersonName,
  type OrgPerson,
} from "@/lib/types/person";
import {
  getNextReviewDueDate,
  isReviewDue,
} from "@/lib/types/rcsa";
import {
  isObligationActive,
  type ObligationRecord,
} from "@/lib/types/obligation";
import type { Risk } from "@/lib/types/risk";

export type ObligationKind =
  | "risk_review"
  | "risk_target"
  | "control_test"
  | "issue_due"
  | "action_due"
  | "obligation_review";

export type ObligationBucket = "overdue" | "week" | "month" | "quarter";

export type Obligation = {
  id: string;
  kind: ObligationKind;
  title: string;
  href: string;
  dueDate: string;
  daysUntil: number;
  bucket: ObligationBucket;
  owner: string;
  detail: string;
};

const KIND_LABEL: Record<ObligationKind, string> = {
  risk_review: "Risk review",
  risk_target: "Treatment target",
  control_test: "Control test",
  issue_due: "Issue due",
  action_due: "Action due",
  obligation_review: "Obligation review",
};

const BUCKET_LABEL: Record<ObligationBucket, string> = {
  overdue: "Overdue / due now",
  week: "Next 7 days",
  month: "8–30 days",
  quarter: "31–90 days",
};

export function formatObligationKind(kind: ObligationKind) {
  return KIND_LABEL[kind];
}

export function formatObligationBucket(bucket: ObligationBucket) {
  return BUCKET_LABEL[bucket];
}

function bucketFor(daysUntil: number): ObligationBucket | null {
  if (daysUntil <= 0) {
    return "overdue";
  }
  if (daysUntil <= 7) {
    return "week";
  }
  if (daysUntil <= 30) {
    return "month";
  }
  if (daysUntil <= 90) {
    return "quarter";
  }
  return null;
}

function ownerName(
  people: OrgPerson[],
  assigneeId: string | null | undefined,
  fallback?: string | null,
) {
  const named = formatPersonName(people, assigneeId);
  if (named !== "Unassigned") {
    return named;
  }
  return fallback?.trim() || "Unassigned";
}

function pushObligation(
  items: Obligation[],
  item: Omit<Obligation, "daysUntil" | "bucket">,
) {
  const daysUntil = daysUntilIsoDate(item.dueDate);
  const bucket = bucketFor(daysUntil);
  if (!bucket) {
    return;
  }

  items.push({ ...item, daysUntil, bucket });
}

export function buildObligations(input: {
  risks: Risk[];
  controls: Control[];
  issues: Issue[];
  actions: IssueAction[];
  lastReviewedByRisk: Record<string, string>;
  people: OrgPerson[];
  registerObligations?: ObligationRecord[];
}): Obligation[] {
  const items: Obligation[] = [];
  const people = input.people;
  const issueById = new Map(input.issues.map((issue) => [issue.id, issue]));

  for (const risk of input.risks) {
    if (!isActiveRisk(risk)) {
      continue;
    }

    const lastReviewed = input.lastReviewedByRisk[risk.id] ?? null;
    if (isReviewDue(lastReviewed, risk.likelihood, risk.impact)) {
      pushObligation(items, {
        id: `review-${risk.id}`,
        kind: "risk_review",
        title: risk.title,
        href: `/risks/${risk.id}/edit`,
        dueDate: getNextReviewDueDate(
          lastReviewed,
          risk.likelihood,
          risk.impact,
        ),
        owner: ownerName(people, risk.assignee_id, risk.owner_email),
        detail: lastReviewed ? "Review cadence lapsed" : "Never reviewed",
      });
    } else {
      pushObligation(items, {
        id: `review-${risk.id}`,
        kind: "risk_review",
        title: risk.title,
        href: `/risks/${risk.id}/edit`,
        dueDate: getNextReviewDueDate(
          lastReviewed,
          risk.likelihood,
          risk.impact,
        ),
        owner: ownerName(people, risk.assignee_id, risk.owner_email),
        detail: "Scheduled RCSA",
      });
    }

    if (risk.target_date && risk.status !== "closed") {
      pushObligation(items, {
        id: `target-${risk.id}`,
        kind: "risk_target",
        title: risk.title,
        href: `/risks/${risk.id}/edit`,
        dueDate: risk.target_date,
        owner: ownerName(people, risk.assignee_id, risk.owner_email),
        detail: "Treatment target date",
      });
    }
  }

  for (const control of input.controls) {
    if (!isTestingDue(control.last_tested_at, control.is_key)) {
      const due = getNextTestDueDate(control.last_tested_at, control.is_key);
      pushObligation(items, {
        id: `test-${control.id}`,
        kind: "control_test",
        title: control.title,
        href: `/controls/${control.id}/edit`,
        dueDate: due,
        owner: ownerName(people, control.assignee_id, control.owner_email),
        detail: control.is_key ? "Key control testing" : "Control testing",
      });
      continue;
    }

    pushObligation(items, {
      id: `test-${control.id}`,
      kind: "control_test",
      title: control.title,
      href: `/controls/${control.id}/edit`,
      dueDate: getNextTestDueDate(control.last_tested_at, control.is_key),
      owner: ownerName(people, control.assignee_id, control.owner_email),
      detail: control.last_tested_at
        ? "Testing cadence lapsed"
        : "Never tested",
    });
  }

  for (const issue of input.issues) {
    if (!isIssueOpen(issue.status) || !issue.due_date) {
      continue;
    }

    pushObligation(items, {
      id: `issue-${issue.id}`,
      kind: "issue_due",
      title: issue.title,
      href: `/issues/${issue.id}/edit`,
      dueDate: issue.due_date,
      owner: ownerName(people, issue.assignee_id, issue.owner_email),
      detail: isIssueOverdue(issue)
        ? "Past target remediation date"
        : "Target remediation date",
    });
  }

  for (const action of input.actions) {
    if (action.status === "completed" || !action.due_date) {
      continue;
    }

    const issue = issueById.get(action.issue_id);
    if (!issue || !isIssueOpen(issue.status)) {
      continue;
    }

    pushObligation(items, {
      id: `action-${action.id}`,
      kind: "action_due",
      title: action.description,
      href: `/issues/${action.issue_id}/edit`,
      dueDate: action.due_date,
      owner: action.assignee_email.trim() || ownerName(people, issue.assignee_id, issue.owner_email),
      detail: `Action on ${issue.title}`,
    });
  }

  for (const obligation of input.registerObligations ?? []) {
    if (!isObligationActive(obligation) || !obligation.review_date) {
      continue;
    }

    pushObligation(items, {
      id: `obligation-${obligation.id}`,
      kind: "obligation_review",
      title: obligation.title,
      href: `/obligations/${obligation.id}/edit`,
      dueDate: obligation.review_date,
      owner: ownerName(people, obligation.assignee_id, obligation.owner_email),
      detail: obligation.source
        ? `Compliance review · ${obligation.source}`
        : "Compliance review",
    });
  }

  return items.sort(
    (left, right) =>
      left.daysUntil - right.daysUntil || left.title.localeCompare(right.title),
  );
}

export function countByBucket(items: Obligation[]) {
  const counts: Record<ObligationBucket, number> = {
    overdue: 0,
    week: 0,
    month: 0,
    quarter: 0,
  };

  for (const item of items) {
    counts[item.bucket] += 1;
  }

  return counts;
}

export function formatDueLabel(item: Obligation) {
  if (item.daysUntil < 0) {
    return `${formatIsoDate(item.dueDate)} · ${Math.abs(item.daysUntil)}d overdue`;
  }
  if (item.daysUntil === 0) {
    return `${formatIsoDate(item.dueDate)} · due today`;
  }
  return `${formatIsoDate(item.dueDate)} · in ${item.daysUntil}d`;
}
