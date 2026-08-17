export type LineOfDefence = "first" | "second" | "third";

export type OrgPerson = {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  line_of_defence: LineOfDefence;
  owner_id?: string;
  owner_email?: string;
};

export const LINE_OF_DEFENCE_OPTIONS: {
  value: LineOfDefence;
  label: string;
}[] = [
  { value: "first", label: "1st line — business / operations" },
  { value: "second", label: "2nd line — risk & compliance" },
  { value: "third", label: "3rd line — internal audit" },
];

export function formatLineOfDefence(value: LineOfDefence | null | undefined) {
  return (
    LINE_OF_DEFENCE_OPTIONS.find((option) => option.value === value)?.label ??
    "1st line — business / operations"
  );
}

export function formatPersonName(
  people: OrgPerson[],
  assigneeId: string | null | undefined,
) {
  if (!assigneeId) {
    return "Unassigned";
  }

  return people.find((person) => person.id === assigneeId)?.name ?? "Unassigned";
}

export function personByEmail(people: OrgPerson[], email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const needle = email.trim().toLowerCase();
  return (
    people.find((person) => person.email.trim().toLowerCase() === needle) ??
    null
  );
}

export function personById(
  people: OrgPerson[],
  id: string | null | undefined,
) {
  if (!id) {
    return null;
  }

  return people.find((person) => person.id === id) ?? null;
}

export function formatPersonDepartment(
  people: OrgPerson[],
  assigneeId: string | null | undefined,
) {
  return personById(people, assigneeId)?.department ?? "";
}

export function departmentFilterOptions(people: OrgPerson[]) {
  const names = [
    ...new Set(
      people
        .map((person) => person.department.trim())
        .filter((department) => department.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return names.map((department) => ({
    value: department,
    label: department,
  }));
}
