export type IssueCommentKind = "comment" | "status_change";

export type IssueComment = {
  id: string;
  issue_id: string;
  body: string;
  kind: IssueCommentKind;
  owner_email?: string;
  owner_id?: string;
  created_at: string;
};

export function formatCommentTimestamp(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}
