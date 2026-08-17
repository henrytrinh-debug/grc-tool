"use client";

import { AssigneeField } from "@/app/components/assignee-field";
import { inputClassName, labelClassName } from "@/app/components/ui";
import { RiskScorePicker } from "@/app/components/risk-score-picker";
import { useSettings } from "@/lib/settings/context";
import {
  RISK_STATUS_OPTIONS,
  RISK_TREATMENT_OPTIONS,
  type NewRisk,
} from "@/lib/types/risk";

type RiskFormFieldsProps = {
  form: NewRisk;
  onChange: (updates: Partial<NewRisk>) => void;
};

export function RiskFormFields({ form, onChange }: RiskFormFieldsProps) {
  const {
    categories,
    schemaReady,
    people,
    enterpriseReady,
    operatingReady,
    governanceReady,
  } = useSettings();

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

      {schemaReady && (
        <>
          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Category</span>
            <select
              value={form.category_id ?? ""}
              onChange={(event) => onChange({ category_id: event.target.value })}
              className={inputClassName}
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Treatment</span>
            <select
              value={form.treatment ?? "mitigate"}
              onChange={(event) =>
                onChange({
                  treatment: event.target.value as NewRisk["treatment"],
                })
              }
              className={inputClassName}
            >
              {RISK_TREATMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {enterpriseReady && (
        <>
          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Status</span>
            <select
              value={form.status ?? "open"}
              onChange={(event) =>
                onChange({ status: event.target.value as NewRisk["status"] })
              }
              className={inputClassName}
            >
              {RISK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <AssigneeField
            value={form.assignee_id ?? ""}
            people={people}
            onChange={(assigneeId) => onChange({ assignee_id: assigneeId })}
          />
        </>
      )}

          {operatingReady && (
            <>
              <label className="flex flex-col gap-1">
                <span className={labelClassName}>Treatment target date</span>
                <input
                  type="date"
                  value={form.target_date ?? ""}
                  onChange={(event) => onChange({ target_date: event.target.value })}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClassName}>Treatment rationale</span>
                <textarea
                  rows={3}
                  value={form.treatment_rationale ?? ""}
                  onChange={(event) =>
                    onChange({ treatment_rationale: event.target.value })
                  }
                  className={inputClassName}
                  placeholder="Why this treatment, residual plan, or acceptance conditions."
                />
              </label>
            </>
          )}

          {governanceReady && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelClassName}>Closure rationale</span>
              <textarea
                rows={3}
                value={form.closure_rationale ?? ""}
                onChange={(event) =>
                  onChange({ closure_rationale: event.target.value })
                }
                className={inputClassName}
                placeholder="Required to close unless this risk already has an RCSA review."
              />
            </label>
          )}
    </>
  );
}
