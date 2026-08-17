"use client";

import { AssigneeField } from "@/app/components/assignee-field";
import { inputClassName, labelClassName } from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import {
  OBLIGATION_STATUS_OPTIONS,
  type NewObligation,
} from "@/lib/types/obligation";

export function ObligationFormFields({
  form,
  onChange,
}: {
  form: NewObligation;
  onChange: (updates: Partial<NewObligation>) => void;
}) {
  const { people, enterpriseReady } = useSettings();

  return (
    <>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Title</span>
        <input
          required
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Source / regulator</span>
        <input
          value={form.source}
          onChange={(event) => onChange({ source: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Citation</span>
        <input
          value={form.citation}
          onChange={(event) => onChange({ citation: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Status</span>
        <select
          value={form.status}
          onChange={(event) =>
            onChange({ status: event.target.value as NewObligation["status"] })
          }
          className={inputClassName}
        >
          {OBLIGATION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Review frequency (days)</span>
        <input
          type="number"
          min={1}
          value={form.review_frequency_days}
          onChange={(event) =>
            onChange({ review_frequency_days: Number(event.target.value) })
          }
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Effective date</span>
        <input
          type="date"
          value={form.effective_date ?? ""}
          onChange={(event) => onChange({ effective_date: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Next review date</span>
        <input
          type="date"
          value={form.review_date ?? ""}
          onChange={(event) => onChange({ review_date: event.target.value })}
          className={inputClassName}
        />
      </label>
      {enterpriseReady ? (
        <div className="sm:col-span-2">
          <AssigneeField
            value={form.assignee_id ?? ""}
            people={people}
            onChange={(assigneeId) => onChange({ assignee_id: assigneeId })}
          />
        </div>
      ) : null}
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Requirement text</span>
        <textarea
          rows={5}
          value={form.requirement_text}
          onChange={(event) =>
            onChange({ requirement_text: event.target.value })
          }
          className={inputClassName}
        />
      </label>
    </>
  );
}
