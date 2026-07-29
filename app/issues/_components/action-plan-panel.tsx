"use client";

import { useState } from "react";
import { IssueActionStatusBadge, OverdueBadge } from "@/app/components/status-badge";
import {
  dangerButtonClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { formatIssueDate, todayIsoDate } from "@/lib/types/issue";
import {
  formatIssueActionStatus,
  getActionProgress,
  ISSUE_ACTION_STATUS_OPTIONS,
  type IssueAction,
  type IssueActionStatus,
  type NewIssueAction,
} from "@/lib/types/issue-action";

type ActionPlanPanelProps = {
  actions: IssueAction[];
  saving: boolean;
  updatingActionId: string | null;
  onAdd: (action: NewIssueAction) => Promise<boolean>;
  onUpdateStatus: (actionId: string, status: IssueActionStatus) => void;
  onDelete: (actionId: string) => void;
};

function emptyActionForm(): NewIssueAction {
  return {
    description: "",
    assignee_email: "",
    due_date: "",
    status: "open",
  };
}

export function ActionPlanPanel({
  actions,
  saving,
  updatingActionId,
  onAdd,
  onUpdateStatus,
  onDelete,
}: ActionPlanPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewIssueAction>(emptyActionForm);

  const progress = getActionProgress(actions);
  const today = todayIsoDate();

  async function handleAdd() {
    if (!form.description.trim()) {
      return;
    }

    const added = await onAdd(form);

    if (added) {
      setForm(emptyActionForm());
      setShowForm(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Action Plan
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {progress.total === 0
              ? "No action items yet. Add at least one before submitting for review."
              : `${progress.completed} of ${progress.total} complete (${progress.percent}%)`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className={secondaryButtonClassName}
        >
          {showForm ? "Cancel" : "Add Action"}
        </button>
      </div>

      {progress.total > 0 && (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-all dark:bg-teal-400"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      {showForm && (
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/60">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClassName}>Action</span>
            <input
              type="text"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Implement quarterly privileged access review"
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Assignee Email</span>
            <input
              type="email"
              value={form.assignee_email}
              onChange={(event) =>
                setForm({ ...form, assignee_email: event.target.value })
              }
              placeholder="owner@example.com"
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Due Date</span>
            <input
              type="date"
              value={form.due_date ?? ""}
              onChange={(event) =>
                setForm({ ...form, due_date: event.target.value })
              }
              className={inputClassName}
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving || !form.description.trim()}
              className={primaryButtonClassName}
            >
              {saving ? "Saving..." : "Save Action"}
            </button>
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Assignee</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Update</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {actions.map((action) => {
                const overdue =
                  action.status !== "completed" &&
                  Boolean(action.due_date) &&
                  (action.due_date ?? "") < today;

                return (
                  <tr key={action.id}>
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">
                      {action.description}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {action.assignee_email || "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-950 dark:text-slate-50">
                          {formatIssueDate(action.due_date)}
                        </span>
                        {overdue && <OverdueBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <IssueActionStatusBadge
                        status={action.status}
                        label={formatIssueActionStatus(action.status)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={action.status}
                        onChange={(event) =>
                          onUpdateStatus(
                            action.id,
                            event.target.value as IssueActionStatus,
                          )
                        }
                        disabled={updatingActionId === action.id}
                        className={inputClassName}
                      >
                        {ISSUE_ACTION_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onDelete(action.id)}
                        disabled={updatingActionId === action.id}
                        className={dangerButtonClassName}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
