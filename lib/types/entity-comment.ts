export type EntityCommentKind = "comment" | "status_change";

export type CommentEntityType =
  | "risk"
  | "control"
  | "incident"
  | "issue"
  | "obligation"
  | "follow_up";

export type EntityComment = {
  id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  body: string;
  kind: EntityCommentKind;
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
