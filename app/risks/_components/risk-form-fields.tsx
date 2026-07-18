import type { NewRisk } from "@/lib/types/risk";
import { inputClassName } from "./constants";

type RiskFormFieldsProps = {
  form: NewRisk;
  onChange: (updates: Partial<NewRisk>) => void;
};

export function RiskFormFields({ form, onChange }: RiskFormFieldsProps) {
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
          Likelihood (1-5)
        </span>
        <select
          value={form.likelihood}
          onChange={(event) =>
            onChange({ likelihood: Number(event.target.value) })
          }
          className={inputClassName}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Impact (1-5)
        </span>
        <select
          value={form.impact}
          onChange={(event) => onChange({ impact: Number(event.target.value) })}
          className={inputClassName}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
