import { groupJoinRows } from "@/lib/types/join-utils";
import {
  CONTROL_JOIN_COLUMNS,
  ISSUE_JOIN_COLUMNS,
  toLinkedControl,
  toLinkedIssue,
  type ControlJoin,
  type IssueJoin,
  type JoinRelation,
} from "@/lib/types/linked-entities";

export const OBLIGATION_CONTROL_SELECT = `id, obligation_id, control_id, ${CONTROL_JOIN_COLUMNS}`;
export const OBLIGATION_ISSUE_SELECT = `id, obligation_id, issue_id, ${ISSUE_JOIN_COLUMNS}`;

export type ObligationControlRow = {
  id: string;
  obligation_id: string;
  control_id: string;
  controls: JoinRelation<ControlJoin>;
};

export type ObligationIssueRow = {
  id: string;
  obligation_id: string;
  issue_id: string;
  issues: JoinRelation<IssueJoin>;
};

export type ObligationControlLink = {
  obligation_id: string;
  control_id: string;
};

export type ObligationIssueLink = {
  obligation_id: string;
  issue_id: string;
};

export function groupControlsByObligation(rows: ObligationControlRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.obligation_id,
    (row) => row.controls,
    (row, control) => toLinkedControl(row.id, row.control_id, control),
  );
}

export function groupIssuesByObligation(rows: ObligationIssueRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.obligation_id,
    (row) => row.issues,
    (row, issue) => toLinkedIssue(row.id, row.issue_id, issue),
  );
}
