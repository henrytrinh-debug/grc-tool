import type { Effectiveness } from "@/lib/types/control";

export function unwrapJoinRelation<T>(
  relation: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

export type RiskControl = {
  id: string;
  risk_id: string;
  control_id: string;
  owner_id?: string;
};

export type LinkedControl = {
  linkId: string;
  controlId: string;
  title: string;
  effectiveness: Effectiveness;
  last_tested_at: string | null;
};

export type LinkedRisk = {
  linkId: string;
  riskId: string;
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
};

type ControlJoin = {
  title: string;
  effectiveness: Effectiveness;
  last_tested_at: string | null;
};

type RiskJoin = {
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
};

export type RiskControlRow = {
  id: string;
  risk_id: string;
  control_id: string;
  controls: ControlJoin | ControlJoin[] | null;
};

export type RiskControlRiskRow = {
  id: string;
  risk_id: string;
  control_id: string;
  risks: RiskJoin | RiskJoin[] | null;
};

export function groupRiskControlRows(
  rows: RiskControlRow[],
): Record<string, LinkedControl[]> {
  const grouped: Record<string, LinkedControl[]> = {};

  for (const row of rows) {
    const control = unwrapJoinRelation(row.controls);

    if (!control) {
      continue;
    }

    if (!grouped[row.risk_id]) {
      grouped[row.risk_id] = [];
    }

    grouped[row.risk_id].push({
      linkId: row.id,
      controlId: row.control_id,
      title: control.title,
      effectiveness: control.effectiveness,
      last_tested_at: control.last_tested_at,
    });
  }

  return grouped;
}

export function groupRiskControlRowsByControl(
  rows: RiskControlRiskRow[],
): Record<string, LinkedRisk[]> {
  const grouped: Record<string, LinkedRisk[]> = {};

  for (const row of rows) {
    const risk = unwrapJoinRelation(row.risks);

    if (!risk) {
      continue;
    }

    if (!grouped[row.control_id]) {
      grouped[row.control_id] = [];
    }

    grouped[row.control_id].push({
      linkId: row.id,
      riskId: row.risk_id,
      title: risk.title,
      likelihood: risk.likelihood,
      impact: risk.impact,
      owner_email: risk.owner_email,
    });
  }

  return grouped;
}
