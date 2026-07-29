"use client";

import { inputClassName, labelClassName } from "@/app/components/ui";
import {
  formatDueDateLabel,
  ISSUE_SEVERITY_OPTIONS,
  ISSUE_SOURCE_OPTIONS,
  type NewIssue,
} from "@/lib/types/issue";

type IssueFormFieldsProps = {
  form: NewIssue;
  onChange: (updates: Partial<NewIssue>) => void;
  /** Closure notes only apply once an issue is being reviewed for closure. */
  showClosureNotes?: boolean;
};

export function IssueFormFields({
  form,
  onChange,
  showClosureNotes = false,
}: IssueFormFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Title</span>
        <input
          type="text"
          required
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Access reviews not performed for privileged accounts"
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="What was observed, and what is the gap?"
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Source</span>
        <select
          value={form.source}
          onChange={(event) =>
            onChange({ source: event.target.value as NewIssue["source"] })
          }
          className={inputClassName}
        >
          {ISSUE_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Severity</span>
        <select
          value={form.severity}
          onChange={(event) =>
            onChange({ severity: event.target.value as NewIssue["severity"] })
          }
          className={inputClassName}
        >
          {ISSUE_SEVERITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Identified On</span>
        <input
          type="date"
          required
          value={form.identified_at}
          onChange={(event) => onChange({ identified_at: event.target.value })}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Target Remediation Date</span>
        <input
          type="date"
          value={form.due_date ?? ""}
          onChange={(event) => onChange({ due_date: event.target.value })}
          className={inputClassName}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDueDateLabel({ due_date: form.due_date, status: form.status })}
        </span>
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Root Cause</span>
        <textarea
          rows={2}
          value={form.root_cause}
          onChange={(event) => onChange({ root_cause: event.target.value })}
          placeholder="Why did this happen? Required before the issue can be closed."
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Remediation Plan</span>
        <textarea
          rows={3}
          value={form.remediation_plan}
          onChange={(event) =>
            onChange({ remediation_plan: event.target.value })
          }
          placeholder="How will this be fixed? Required before submitting for review."
          className={inputClassName}
        />
      </label>

      {showClosureNotes && (
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClassName}>Closure Notes</span>
          <textarea
            rows={2}
            value={form.closure_notes}
            onChange={(event) =>
              onChange({ closure_notes: event.target.value })
            }
            placeholder="Evidence that remediation is complete. Required before closing."
            className={inputClassName}
          />
        </label>
      )}
    </>
  );
}
