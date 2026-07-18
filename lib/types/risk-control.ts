import type { Effectiveness } from "@/lib/types/control";

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

export type RiskControlRow = {
  id: string;
  risk_id: string;
  control_id: string;
  controls: {
    title: string;
    effectiveness: Effectiveness;
    last_tested_at: string | null;
  } | null;
};

export type RiskControlRiskRow = {
  id: string;
  risk_id: string;
  control_id: string;
  risks: {
    title: string;
    likelihood: number;
    impact: number;
    owner_email?: string;
  } | null;
};

export function groupRiskControlRows(
  rows: RiskControlRow[],
): Record<string, LinkedControl[]> {
  const grouped: Record<string, LinkedControl[]> = {};

  for (const row of rows) {
    if (!row.controls) {
      continue;
    }

    if (!grouped[row.risk_id]) {
      grouped[row.risk_id] = [];
    }

    grouped[row.risk_id].push({
      linkId: row.id,
      controlId: row.control_id,
      title: row.controls.title,
      effectiveness: row.controls.effectiveness,
      last_tested_at: row.controls.last_tested_at,
    });
  }

  return grouped;
}

export function groupRiskControlRowsByControl(
  rows: RiskControlRiskRow[],
): Record<string, LinkedRisk[]> {
  const grouped: Record<string, LinkedRisk[]> = {};

  for (const row of rows) {
    if (!row.risks) {
      continue;
    }

    if (!grouped[row.control_id]) {
      grouped[row.control_id] = [];
    }

    grouped[row.control_id].push({
      linkId: row.id,
      riskId: row.risk_id,
      title: row.risks.title,
      likelihood: row.risks.likelihood,
      impact: row.risks.impact,
      owner_email: row.risks.owner_email,
    });
  }

  return grouped;
}
