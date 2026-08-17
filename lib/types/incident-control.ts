import { groupJoinRows } from "@/lib/types/join-utils";
import {
  CONTROL_JOIN_COLUMNS,
  INCIDENT_JOIN_COLUMNS,
  toLinkedControl,
  toLinkedIncident,
  type ControlJoin,
  type IncidentJoin,
  type JoinRelation,
} from "@/lib/types/linked-entities";

export const INCIDENT_CONTROL_CONTROL_SELECT = `id, incident_id, control_id, ${CONTROL_JOIN_COLUMNS}`;
export const INCIDENT_CONTROL_INCIDENT_SELECT = `id, incident_id, control_id, ${INCIDENT_JOIN_COLUMNS}`;

export type IncidentControlRow = {
  id: string;
  incident_id: string;
  control_id: string;
  controls: JoinRelation<ControlJoin>;
};

export type IncidentControlIncidentRow = {
  id: string;
  incident_id: string;
  control_id: string;
  incidents: JoinRelation<IncidentJoin>;
};

export function groupIncidentControlRowsByIncident(rows: IncidentControlRow[]) {
  return groupJoinRows(
    rows,
    (row) => row.incident_id,
    (row) => row.controls,
    (row, control) => toLinkedControl(row.id, row.control_id, control),
  );
}

export function groupIncidentControlRowsByControl(
  rows: IncidentControlIncidentRow[],
) {
  return groupJoinRows(
    rows,
    (row) => row.control_id,
    (row) => row.incidents,
    (row, incident) => toLinkedIncident(row.id, row.incident_id, incident),
  );
}
