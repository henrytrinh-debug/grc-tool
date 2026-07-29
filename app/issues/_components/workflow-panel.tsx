"use client";

import { IssueStatusBadge } from "@/app/components/status-badge";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import {
  getAvailableTransitions,
  ISSUE_WORKFLOW_STAGES,
} from "@/lib/issues/workflow";
import {
  formatIssueStatus,
  type Issue,
  type IssueStatus,
} from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";

type WorkflowPanelProps = {
  issue: Issue;
  actions: IssueAction[];
  transitioningTo: IssueStatus | null;
  /** Gates are evaluated against saved values, so warn before transitioning. */
  unsavedChanges?: boolean;
  onTransition: (to: IssueStatus) => void;
};

export function WorkflowPanel({
  issue,
  actions,
  transitioningTo,
  unsavedChanges = false,
  onTransition,
}: WorkflowPanelProps) {
  const transitions = getAvailableTransitions(issue, actions);
  const currentStageIndex = ISSUE_WORKFLOW_STAGES.indexOf(issue.status);

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Workflow
        </h2>
        <IssueStatusBadge
          status={issue.status}
          label={formatIssueStatus(issue.status)}
        />
      </div>

      <ol className="flex flex-wrap items-center gap-2">
        {ISSUE_WORKFLOW_STAGES.map((stage, index) => {
          const isCurrent = stage === issue.status;
          const isComplete = index < currentStageIndex;

          return (
            <li key={stage} className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isCurrent
                    ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-slate-950"
                    : isComplete
                      ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {formatIssueStatus(stage)}
              </span>
              {index < ISSUE_WORKFLOW_STAGES.length - 1 && (
                <span
                  aria-hidden
                  className="text-slate-300 dark:text-slate-600"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {unsavedChanges && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          You have unsaved detail changes. Save them before moving this issue
          forward, otherwise the checks below use the last saved values.
        </p>
      )}

      <div className="space-y-3">
        {transitions.map((transition, index) => (
          <div key={transition.to} className="space-y-2">
            <button
              type="button"
              onClick={() => onTransition(transition.to)}
              disabled={!transition.allowed || transitioningTo !== null}
              className={
                index === 0 ? primaryButtonClassName : secondaryButtonClassName
              }
            >
              {transitioningTo === transition.to
                ? "Updating..."
                : transition.label}
            </button>

            {transition.blockers.length > 0 && (
              <ul className="ml-1 list-inside list-disc space-y-1 text-sm text-amber-700 dark:text-amber-400">
                {transition.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
