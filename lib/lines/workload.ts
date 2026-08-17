import { getTestingStatus, type Control } from "@/lib/types/control";
import { isIncidentOpen, type Incident } from "@/lib/types/incident";
import { isIssueOpen, isIssueOverdue, type Issue } from "@/lib/types/issue";
import {
  formatLineOfDefence,
  type LineOfDefence,
  type OrgPerson,
} from "@/lib/types/person";
import { isActiveRisk } from "@/lib/taxonomy";
import type { Risk } from "@/lib/types/risk";

export type PersonWorkload = {
  person: OrgPerson | null;
  risks: number;
  controlsOverdue: number;
  incidents: number;
  issues: number;
  issuesOverdue: number;
  total: number;
};

export type LodWorkload = {
  line: LineOfDefence | "unassigned";
  label: string;
  people: PersonWorkload[];
  totals: Omit<PersonWorkload, "person">;
};

const LOD_ORDER: Array<LineOfDefence | "unassigned"> = [
  "first",
  "second",
  "third",
  "unassigned",
];

function emptyCounts(): Omit<PersonWorkload, "person"> {
  return {
    risks: 0,
    controlsOverdue: 0,
    incidents: 0,
    issues: 0,
    issuesOverdue: 0,
    total: 0,
  };
}

function addCounts(
  target: Omit<PersonWorkload, "person">,
  source: Omit<PersonWorkload, "person">,
) {
  target.risks += source.risks;
  target.controlsOverdue += source.controlsOverdue;
  target.incidents += source.incidents;
  target.issues += source.issues;
  target.issuesOverdue += source.issuesOverdue;
  target.total += source.total;
}

export function buildLodWorkload(input: {
  people: OrgPerson[];
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
}): LodWorkload[] {
  const byPerson = new Map<string, PersonWorkload>();

  for (const person of input.people) {
    byPerson.set(person.id, { person, ...emptyCounts() });
  }

  const unassigned: PersonWorkload = { person: null, ...emptyCounts() };

  function bucket(assigneeId: string | null | undefined) {
    if (!assigneeId) {
      return unassigned;
    }
    return byPerson.get(assigneeId) ?? unassigned;
  }

  for (const risk of input.risks) {
    if (!isActiveRisk(risk)) {
      continue;
    }
    const row = bucket(risk.assignee_id);
    row.risks += 1;
    row.total += 1;
  }

  for (const control of input.controls) {
    if (getTestingStatus(control.last_tested_at, control.is_key) !== "Overdue") {
      continue;
    }
    const row = bucket(control.assignee_id);
    row.controlsOverdue += 1;
    row.total += 1;
  }

  for (const incident of input.incidents) {
    if (!isIncidentOpen(incident.status)) {
      continue;
    }
    const row = bucket(incident.assignee_id);
    row.incidents += 1;
    row.total += 1;
  }

  for (const issue of input.issues) {
    if (!isIssueOpen(issue.status)) {
      continue;
    }
    const row = bucket(issue.assignee_id);
    row.issues += 1;
    row.total += 1;
    if (isIssueOverdue(issue)) {
      row.issuesOverdue += 1;
    }
  }

  const groups = new Map<LineOfDefence | "unassigned", PersonWorkload[]>();
  for (const line of LOD_ORDER) {
    groups.set(line, []);
  }

  for (const row of byPerson.values()) {
    if (row.total === 0) {
      continue;
    }
    const line = row.person?.line_of_defence ?? "unassigned";
    groups.get(line)?.push(row);
  }

  if (unassigned.total > 0) {
    groups.get("unassigned")?.push(unassigned);
  }

  return LOD_ORDER.map((line) => {
    const people = (groups.get(line) ?? []).sort(
      (left, right) =>
        right.total - left.total ||
        (left.person?.name ?? "Unassigned").localeCompare(
          right.person?.name ?? "Unassigned",
        ),
    );
    const totals = emptyCounts();
    for (const row of people) {
      addCounts(totals, row);
    }

    return {
      line,
      label:
        line === "unassigned"
          ? "Unassigned"
          : formatLineOfDefence(line).split(" — ")[0],
      people,
      totals,
    };
  }).filter((group) => group.people.length > 0);
}
