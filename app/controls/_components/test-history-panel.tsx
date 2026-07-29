"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { EffectivenessBadge } from "@/app/components/status-badge";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import {
  TEST_RESULT_EFFECTIVENESS_OPTIONS,
  formatEffectiveness,
} from "@/lib/types/control";
import {
  formatTestedAt,
  getTodayDateForInput,
  type ControlTestResult,
  type NewControlTestResult,
} from "@/lib/types/control-test-result";

type TestHistoryPanelProps = {
  controlId: string;
  controlTitle: string;
  testResults: ControlTestResult[];
  loading: boolean;
  recording: boolean;
  onRecordTestResult: (payload: NewControlTestResult) => Promise<void>;
};

const emptyRecordForm: NewControlTestResult = {
  effectiveness: "effective",
  tested_at: getTodayDateForInput(),
  notes: "",
};

/**
 * Deep-links into the issue intake form with the control failure pre-filled.
 */
function buildRaiseIssueHref(
  controlId: string,
  controlTitle: string,
  result: ControlTestResult,
) {
  const params = new URLSearchParams({
    source: "control_failure",
    control: controlId,
    severity: "high",
    title: `Control failure: ${controlTitle}`,
    description: [
      `Testing on ${formatTestedAt(result.tested_at)} found this control ineffective.`,
      result.notes,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return `/issues/new?${params.toString()}`;
}

export function TestHistoryPanel({
  controlId,
  controlTitle,
  testResults,
  loading,
  recording,
  onRecordTestResult,
}: TestHistoryPanelProps) {
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] =
    useState<NewControlTestResult>(emptyRecordForm);

  function updateRecordForm(updates: Partial<NewControlTestResult>) {
    setRecordForm((current) => ({ ...current, ...updates }));
  }

  function openRecordForm() {
    setRecordForm({
      ...emptyRecordForm,
      tested_at: getTodayDateForInput(),
    });
    setShowRecordForm(true);
  }

  function closeRecordForm() {
    setShowRecordForm(false);
    setRecordForm(emptyRecordForm);
  }

  async function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onRecordTestResult(recordForm);
      closeRecordForm();
    } catch {
      // Parent surfaces errors; keep the form open for retry.
    }
  }

  const latestResult = testResults[0];
  const latestFailed = latestResult?.effectiveness === "ineffective";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-slate-950 dark:text-slate-50">
          Test History
        </h3>
        {!showRecordForm && (
          <button
            type="button"
            onClick={openRecordForm}
            className={primaryButtonClassName}
          >
            Record Test Result
          </button>
        )}
      </div>

      {latestFailed && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p>
            The most recent test found this control ineffective. Raise an issue
            to track remediation.
          </p>
          <Link
            href={buildRaiseIssueHref(controlId, controlTitle, latestResult)}
            className={`${secondaryButtonClassName} shrink-0 bg-white dark:bg-slate-900`}
          >
            Raise Issue
          </Link>
        </div>
      )}

      {showRecordForm && (
        <form
          onSubmit={(event) => void handleRecordSubmit(event)}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950"
        >
          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Effectiveness</span>
            <select
              required
              value={recordForm.effectiveness}
              onChange={(event) =>
                updateRecordForm({
                  effectiveness: event.target
                    .value as NewControlTestResult["effectiveness"],
                })
              }
              className={inputClassName}
            >
              {TEST_RESULT_EFFECTIVENESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Tested At</span>
            <input
              required
              type="date"
              value={recordForm.tested_at}
              onChange={(event) =>
                updateRecordForm({ tested_at: event.target.value })
              }
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClassName}>Notes</span>
            <textarea
              rows={3}
              value={recordForm.notes}
              onChange={(event) =>
                updateRecordForm({ notes: event.target.value })
              }
              className={inputClassName}
            />
          </label>

          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={recording}
              className={primaryButtonClassName}
            >
              {recording ? "Saving..." : "Save Test Result"}
            </button>
            <button
              type="button"
              onClick={closeRecordForm}
              disabled={recording}
              className={secondaryButtonClassName}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Loading test history...
        </p>
      ) : testResults.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No test results recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Effectiveness</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {testResults.map((result) => (
                <tr key={result.id}>
                  <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                    {formatTestedAt(result.tested_at)}
                  </td>
                  <td className="px-4 py-3">
                    <EffectivenessBadge
                      effectiveness={result.effectiveness}
                      label={formatEffectiveness(result.effectiveness)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {result.notes || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {result.effectiveness === "ineffective" && (
                      <Link
                        href={buildRaiseIssueHref(
                          controlId,
                          controlTitle,
                          result,
                        )}
                        className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
                      >
                        Raise Issue
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
