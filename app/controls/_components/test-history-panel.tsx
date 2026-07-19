import { FormEvent, useState } from "react";
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
import { inputClassName } from "./constants";

type TestHistoryPanelProps = {
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

export function TestHistoryPanel({
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

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          Test History
        </h3>
        {!showRecordForm && (
          <button
            type="button"
            onClick={openRecordForm}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Record Test Result
          </button>
        )}
      </div>

      {showRecordForm && (
        <form
          onSubmit={(event) => void handleRecordSubmit(event)}
          className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Effectiveness
            </span>
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
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tested At
            </span>
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
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes
            </span>
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
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
            >
              {recording ? "Saving..." : "Save Test Result"}
            </button>
            <button
              type="button"
              onClick={closeRecordForm}
              disabled={recording}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading test history...
        </p>
      ) : testResults.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No test results recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Effectiveness</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {testResults.map((result) => (
                <tr key={result.id}>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {formatTestedAt(result.tested_at)}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {formatEffectiveness(result.effectiveness)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {result.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
