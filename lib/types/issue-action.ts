export type IssueActionStatus = "open" | "in_progress" | "completed";

export type IssueAction = {
  id: string;
  issue_id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: IssueActionStatus;
  completed_at: string | null;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewIssueAction = Pick<
  IssueAction,
  "description" | "assignee_email" | "due_date" | "status"
>;

export const ISSUE_ACTION_STATUS_OPTIONS: {
  value: IssueActionStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export function formatIssueActionStatus(status: IssueActionStatus) {
  return (
    ISSUE_ACTION_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}

export type ActionProgress = {
  total: number;
  completed: number;
  percent: number;
};

export function getActionProgress(actions: IssueAction[]): ActionProgress {
  const total = actions.length;
  const completed = actions.filter(
    (action) => action.status === "completed",
  ).length;

  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
