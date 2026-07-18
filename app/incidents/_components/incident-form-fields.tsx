import {
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  type NewIncident,
} from "@/lib/types/incident";
import { inputClassName } from "./constants";

type IncidentFormFieldsProps = {
  form: NewIncident;
  onChange: (updates: Partial<NewIncident>) => void;
};

export function IncidentFormFields({ form, onChange }: IncidentFormFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Root Cause
        </span>
        <textarea
          rows={3}
          value={form.root_cause}
          onChange={(event) => onChange({ root_cause: event.target.value })}
          className={inputClassName}
        />
      </label>
    </>
  );
}
