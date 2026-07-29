import { groupJoinRows } from "@/lib/types/join-utils";
import {
  CONTROL_JOIN_COLUMNS,
  RISK_JOIN_COLUMNS,
  toLinkedControl,
  toLinkedRisk,
  type ControlJoin,
  type JoinRelation,
  type RiskJoin,
} from "@/lib/types/linked-entities";

export const RISK_CONTROL_SELECT = `id, risk_id, control_id, ${CONTROL_JOIN_COLUMNS}`;

export const RISK_CONTROL_RISK_SELECT = `id, risk_id, control_id, ${RISK_JOIN_COLUMNS}`;

export type RiskControlRow = {
  id: string;
  risk_id: string;
  control_id: string;
  controls: JoinRelation<ControlJoin>;
};

export type RiskControlRiskRow = {
  id: string;
  risk_id: string;
  control_id: string;
  risks: JoinRelation<RiskJoin>;
};

/** Controls linked to each risk, keyed by risk id. */
export function groupRiskControlRows(rows: RiskControlRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.risk_id,
    (row) => row.controls,
    (row, control) => toLinkedControl(row.id, row.control_id, control),
  );
}

/** Risks linked to each control, keyed by control id. */
export function groupRiskControlRowsByControl(rows: RiskControlRiskRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.control_id,
    (row) => row.risks,
    (row, risk) => toLinkedRisk(row.id, row.risk_id, risk),
  );
}
