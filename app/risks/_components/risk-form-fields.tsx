import { inputClassName, labelClassName } from "@/app/components/ui";
import { RiskScorePicker } from "@/app/components/risk-score-picker";
import type { NewRisk } from "@/lib/types/risk";

type RiskFormFieldsProps = {
  form: NewRisk;
  onChange: (updates: Partial<NewRisk>) => void;
};

export function RiskFormFields({ form, onChange }: RiskFormFieldsProps) {
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

      <div className="sm:col-span-2">
        <RiskScorePicker
          likelihood={form.likelihood}
          impact={form.impact}
          onChange={onChange}
          description="Click a cell to set both ratings. The colour is the resulting inherent risk score."
        />
      </div>
    </>
  );
}
