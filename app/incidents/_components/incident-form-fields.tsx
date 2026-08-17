"use client";

import { AssigneeField } from "@/app/components/assignee-field";
import { inputClassName, labelClassName } from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import {
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  type NewIncident,
} from "@/lib/types/incident";

type IncidentFormFieldsProps = {
  form: NewIncident;
  onChange: (updates: Partial<NewIncident>) => void;
};

export function IncidentFormFields({ form, onChange }: IncidentFormFieldsProps) {
  const { people, enterpriseReady } = useSettings();

  return (
    <>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>
          Title
        </span>
        <input
          required
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>
          Description
        </span>
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>
          Date Occurred
        </span>
        <input
          required
          type="date"
          value={form.date_occurred}
          onChange={(event) =>
            onChange({ date_occurred: event.target.value })
          }
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>
          Severity
        </span>
        <select
          value={form.severity}
          onChange={(event) =>
            onChange({
              severity: event.target.value as NewIncident["severity"],
            })
          }
          className={inputClassName}
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>
          Status
        </span>
        <select
          value={form.status}
          onChange={(event) =>
            onChange({
              status: event.target.value as NewIncident["status"],
            })
          }
          className={inputClassName}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>
          Root Cause
        </span>
        <textarea
          rows={3}
          value={form.root_cause}
          onChange={(event) => onChange({ root_cause: event.target.value })}
          className={inputClassName}
        />
      </label>

      {enterpriseReady && (
        <div className="sm:col-span-2">
          <AssigneeField
            value={form.assignee_id ?? ""}
            people={people}
            onChange={(assigneeId) => onChange({ assignee_id: assigneeId })}
          />
        </div>
      )}
    </>
  );
}
