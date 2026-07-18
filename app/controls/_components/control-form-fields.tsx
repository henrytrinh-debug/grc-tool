import {
  EFFECTIVENESS_OPTIONS,
  type NewControl,
} from "@/lib/types/control";
import { inputClassName } from "./constants";

type ControlFormFieldsProps = {
  form: NewControl;
  onChange: (updates: Partial<NewControl>) => void;
};

export function ControlFormFields({ form, onChange }: ControlFormFieldsProps) {
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

      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.is_key}
          onChange={(event) => onChange({ is_key: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Key control
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Effectiveness
        </span>
        <select
          value={form.effectiveness}
          onChange={(event) =>
            onChange({
              effectiveness: event.target.value as NewControl["effectiveness"],
            })
          }
          className={inputClassName}
        >
          {EFFECTIVENESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Last Tested At
        </span>
        <input
          type="date"
          value={form.last_tested_at ?? ""}
          onChange={(event) =>
            onChange({
              last_tested_at: event.target.value || null,
            })
          }
          className={inputClassName}
        />
      </label>
    </>
  );
}
