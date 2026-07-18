import { formatEffectiveness, type Control } from "@/lib/types/control";
import { formatIncidentStatus, type Incident } from "@/lib/types/incident";
import type { Risk } from "@/lib/types/risk";

export type SeverityBand = "Low" | "Medium" | "High" | "Critical";

export type SeverityBandCount = {
  band: SeverityBand;
  count: number;
};

export type ChartCount = {
  name: string;
  value: number;
};

export function getRiskScore(likelihood: number, impact: number) {
  return likelihood * impact;
}

export function getSeverityBand(score: number): SeverityBand {
  if (score <= 5) {
    return "Low";
  }

  if (score <= 10) {
    return "Medium";
  }

  if (score <= 19) {
    return "High";
  }

  return "Critical";
}

export function buildRiskHeatMap(risks: Risk[]) {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));

  for (const risk of risks) {
    const likelihoodIndex = risk.likelihood - 1;
    const impactIndex = risk.impact - 1;

    if (
      likelihoodIndex >= 0 &&
      likelihoodIndex < 5 &&
      impactIndex >= 0 &&
      impactIndex < 5
    ) {
      grid[likelihoodIndex][impactIndex] += 1;
    }
  }

  return grid;
}

export function buildSeverityBandCounts(risks: Risk[]): SeverityBandCount[] {
  const counts: Record<SeverityBand, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  for (const risk of risks) {
    const band = getSeverityBand(getRiskScore(risk.likelihood, risk.impact));
    counts[band] += 1;
  }

  return [
    { band: "Low", count: counts.Low },
    { band: "Medium", count: counts.Medium },
    { band: "High", count: counts.High },
    { band: "Critical", count: counts.Critical },
  ];
}

export function getHeatMapCellColor(score: number, count: number) {
  if (count === 0) {
    return "rgb(244 244 245)";
  }

  const ratio = (score - 1) / 24;
  const hue = 120 - ratio * 120;

  return `hsl(${hue} 65% 42%)`;
}

export function buildControlEffectivenessCounts(
  controls: Control[],
): ChartCount[] {
  const counts = {
    effective: 0,
    ineffective: 0,
    not_tested: 0,
  };

  for (const control of controls) {
    counts[control.effectiveness] += 1;
  }

  return [
    { name: formatEffectiveness("effective"), value: counts.effective },
    { name: formatEffectiveness("ineffective"), value: counts.ineffective },
    { name: formatEffectiveness("not_tested"), value: counts.not_tested },
  ];
}

export function buildIncidentStatusCounts(incidents: Incident[]): ChartCount[] {
  const counts = {
    open: 0,
    investigating: 0,
    resolved: 0,
  };

  for (const incident of incidents) {
    counts[incident.status] += 1;
  }

  return [
    { name: formatIncidentStatus("open"), value: counts.open },
    {
      name: formatIncidentStatus("investigating"),
      value: counts.investigating,
    },
    { name: formatIncidentStatus("resolved"), value: counts.resolved },
  ];
}
