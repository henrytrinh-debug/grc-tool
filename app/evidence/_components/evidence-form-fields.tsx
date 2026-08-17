"use client";

import { AssigneeField } from "@/app/components/assignee-field";
import { inputClassName, labelClassName } from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import type { EvidenceEntityOption } from "@/lib/evidence/entities";
import {
  EVIDENCE_ENTITY_OPTIONS,
  type EvidenceEntityType,
  type NewEvidence,
} from "@/lib/types/evidence";

export function EvidenceFormFields({
  form,
  onChange,
  entityOptions,
}: {
  form: NewEvidence;
  onChange: (updates: Partial<NewEvidence>) => void;
  entityOptions: EvidenceEntityOption[];
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
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Evidence date</span>
        <input
          type="date"
          value={form.evidence_date ?? ""}
          onChange={(event) => onChange({ evidence_date: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Retention date</span>
        <input
          type="date"
          value={form.retention_date ?? ""}
          onChange={(event) => onChange({ retention_date: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Source</span>
        <input
          value={form.source}
          onChange={(event) => onChange({ source: event.target.value })}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Linked record type</span>
        <select
          required
          value={form.entity_type}
          onChange={(event) =>
            onChange({
              entity_type: event.target.value as EvidenceEntityType,
              entity_id: "",
            })
          }
          className={inputClassName}
        >
          {EVIDENCE_ENTITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClassName}>Linked record</span>
        <select
          required
          value={form.entity_id}
          onChange={(event) => onChange({ entity_id: event.target.value })}
          className={inputClassName}
        >
          <option value="">Select a record</option>
          {entityOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
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
    </>
  );
}
