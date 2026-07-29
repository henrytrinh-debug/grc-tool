import {
  getDefaultDueDate,
  todayIsoDate,
  type NewIssue,
} from "@/lib/types/issue";

export function createEmptyIssueForm(): NewIssue {
  return {
    title: "",
    description: "",
    source: "self_identified",
    severity: "medium",
    status: "open",
    identified_at: todayIsoDate(),
    due_date: getDefaultDueDate("medium"),
    root_cause: "",
    remediation_plan: "",
    closure_notes: "",
  };
}
