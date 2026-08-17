import { groupJoinRows } from "@/lib/types/join-utils";
import {
  CONTROL_JOIN_COLUMNS,
  ISSUE_JOIN_COLUMNS,
  RISK_JOIN_COLUMNS,
  RISK_JOIN_COLUMNS_WITH_CATEGORY,
  toLinkedControl,
  toLinkedIssue,
  toLinkedRisk,
  type ControlJoin,
  type IssueJoin,
  type JoinRelation,
  type RiskJoin,
} from "@/lib/types/linked-entities";

export const ISSUE_RISK_SELECT = `id, issue_id, risk_id, ${RISK_JOIN_COLUMNS}`;
export const ISSUE_RISK_SELECT_WITH_CATEGORY = `id, issue_id, risk_id, ${RISK_JOIN_COLUMNS_WITH_CATEGORY}`;

export const ISSUE_RISK_ISSUE_SELECT = `id, issue_id, risk_id, ${ISSUE_JOIN_COLUMNS}`;

export const ISSUE_CONTROL_SELECT = `id, issue_id, control_id, ${CONTROL_JOIN_COLUMNS}`;

export const ISSUE_CONTROL_ISSUE_SELECT = `id, issue_id, control_id, ${ISSUE_JOIN_COLUMNS}`;

export type IssueRiskRow = {
  id: string;
  issue_id: string;
  risk_id: string;
  risks: JoinRelation<RiskJoin>;
};

export type IssueRiskIssueRow = {
  id: string;
  issue_id: string;
  risk_id: string;
  issues: JoinRelation<IssueJoin>;
};

export type IssueControlRow = {
  id: string;
  issue_id: string;
  control_id: string;
  controls: JoinRelation<ControlJoin>;
};

export type IssueControlIssueRow = {
  id: string;
  issue_id: string;
  control_id: string;
  issues: JoinRelation<IssueJoin>;
};

/** Risks linked to each issue, keyed by issue id. */
export function groupRisksByIssue(rows: IssueRiskRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.issue_id,
    (row) => row.risks,
    (row, risk) => toLinkedRisk(row.id, row.risk_id, risk),
  );
}

/** Issues linked to each risk, keyed by risk id. */
export function groupIssuesByRisk(rows: IssueRiskIssueRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.risk_id,
    (row) => row.issues,
    (row, issue) => toLinkedIssue(row.id, row.issue_id, issue),
  );
}

/** Controls linked to each issue, keyed by issue id. */
export function groupControlsByIssue(rows: IssueControlRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.issue_id,
    (row) => row.controls,
    (row, control) => toLinkedControl(row.id, row.control_id, control),
  );
}

/** Issues linked to each control, keyed by control id. */
export function groupIssuesByControl(rows: IssueControlIssueRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.control_id,
    (row) => row.issues,
    (row, issue) => toLinkedIssue(row.id, row.issue_id, issue),
  );
}
