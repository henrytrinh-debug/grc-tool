"use client";

import Link from "next/link";
import {
  IssueSeverityBadge,
  IssueStatusBadge,
  OverdueBadge,
} from "@/app/components/status-badge";
import { ExpandableList } from "@/app/components/expandable-list";
import { secondaryButtonClassName } from "@/app/components/ui";
import {
  formatDueDateLabel,
  formatIssueSeverity,
  formatIssueStatus,
  isIssueOverdue,
} from "@/lib/types/issue";
import type { LinkedIssue } from "@/lib/types/linked-entities";

type RelatedIssuesCardProps = {
  issues: LinkedIssue[];
  /** Pre-fills the issue intake form when raising a new issue from here. */
  raiseIssueHref: string;
  emptyMessage: string;
};

export function RelatedIssuesCard({
  issues,
  raiseIssueHref,
  emptyMessage,
}: RelatedIssuesCardProps) {
  const openIssues = issues.filter((issue) => issue.status !== "closed");

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-950 dark:text-slate-50">
            Related Issues
          </h3>
          {issues.length > 0 && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {openIssues.length} open of {issues.length} total
            </p>
          )}
        </div>
        <Link href={raiseIssueHref} className={secondaryButtonClassName}>
          Raise Issue
        </Link>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          <ExpandableList
            items={issues}
            limit={5}
            renderItem={(issue) => (
            <div
              key={issue.linkId}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/issues/${issue.issueId}/edit`}
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                {issue.title}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <IssueSeverityBadge
                  severity={issue.severity}
                  label={formatIssueSeverity(issue.severity)}
                />
                <IssueStatusBadge
                  status={issue.status}
                  label={formatIssueStatus(issue.status)}
                />
                <span>{formatDueDateLabel(issue)}</span>
                {isIssueOverdue(issue) && <OverdueBadge />}
              </div>
            </div>
            )}
          />
        </div>
      )}
    </section>
  );
}
