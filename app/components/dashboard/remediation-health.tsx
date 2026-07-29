"use client";

import Link from "next/link";
import { IssueSeverityBadge } from "@/app/components/status-badge";
import type {
  IssueSeverityBreakdown,
  IssueSummary,
} from "@/lib/dashboard/analytics";
import { formatIssueSeverity } from "@/lib/types/issue";

type RemediationHealthProps = {
  summary: IssueSummary;
  breakdown: IssueSeverityBreakdown[];
};

export function RemediationHealth({
  summary,
  breakdown,
}: RemediationHealthProps) {
  if (summary.total === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No issues raised yet.{" "}
        <Link
          href="/issues/new"
          className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
        >
          Raise the first issue
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Action plan completion across open issues
          </p>
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            {summary.actionCompletionPercent}%
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={summary.actionCompletionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
            style={{ width: `${summary.actionCompletionPercent}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {breakdown
          .filter((row) => row.open > 0)
          .map((row) => (
            <li key={row.severity}>
              <Link
                href={`/issues?severity=${row.severity}&status=open,in_progress,pending_review`}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40 dark:border-slate-800 dark:hover:border-teal-700 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <IssueSeverityBadge
                    severity={row.severity}
                    label={formatIssueSeverity(row.severity)}
                  />
                  <span className="text-slate-950 dark:text-slate-50">
                    {row.open} open
                  </span>
                </span>
                {row.overdue > 0 && (
                  <span className="font-medium text-red-700 dark:text-red-400">
                    {row.overdue} overdue
                  </span>
                )}
              </Link>
            </li>
          ))}
      </ul>

      {summary.awaitingReview > 0 && (
        <Link
          href="/issues?status=pending_review"
          className="block rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 transition-colors hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900/60"
        >
          <span className="font-medium">
            {summary.awaitingReview} issue
            {summary.awaitingReview === 1 ? "" : "s"} awaiting your review.
          </span>{" "}
          Review and close →
        </Link>
      )}
    </div>
  );
}
