"use client";

import { inputClassName, labelClassName } from "@/app/components/ui";
import { formatLineOfDefence, type OrgPerson } from "@/lib/types/person";

type AssigneeFieldProps = {
  value: string;
  people: OrgPerson[];
  onChange: (assigneeId: string) => void;
  label?: string;
};

export function AssigneeField({
  value,
  people,
  onChange,
  label = "Accountable owner",
}: AssigneeFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClassName}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        <option value="">Unassigned</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
            {person.title ? ` · ${person.title}` : ""}
            {` · ${formatLineOfDefence(person.line_of_defence).split(" — ")[0]}`}
          </option>
        ))}
      </select>
    </label>
  );
}
