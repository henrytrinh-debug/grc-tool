import { inherentBand, inherentScore, operatingBand, operatingScore, storedResidual } from "@/lib/risk/ratings";
import {
  appetiteBreachingRisks,
  highCriticalRisks,
  overdueControls,
  overdueIssues,
  severeOpenIncidents,
  uncontrolledHighCriticalRisks,
} from "@/lib/metrics/kpis";
import {
  BOARD_SECTION_IDS,
  type BoardSectionId,
} from "@/lib/settings/preferences";
import type { RiskCategory } from "@/lib/settings/defaults";
import type { Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { Risk } from "@/lib/types/risk";

export type BoardHeadline = {
  label: string;
  value: number;
  href: string;
  tone: "alert" | "default";
  hint: string;
};

export type BoardRow = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type BoardPack = {
  generatedAt: string;
  headlines: BoardHeadline[];
  appetiteBreaches: BoardRow[];
  criticalRisks: BoardRow[];
  overdueKeyControls: BoardRow[];
  overdueIssues: BoardRow[];
  openSevereIncidents: BoardRow[];
};

export function buildBoardPack(input: {
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
  categories: RiskCategory[];
  linkedControlCounts: Record<string, number>;
}): BoardPack {
  const { risks, controls, incidents, issues, categories, linkedControlCounts } =
    input;

  const appetite = appetiteBreachingRisks(risks, categories);
  const critical = highCriticalRisks(risks);
  const overdueKey = overdueControls(controls, { keyOnly: true });
  const lateIssues = overdueIssues(issues);
  const severeIncidents = severeOpenIncidents(incidents);
  const uncontrolledHigh = uncontrolledHighCriticalRisks(
    risks,
    linkedControlCounts,
  );

  function riskRow(risk: Risk): BoardRow {
    const inherent = inherentBand(risk);
    const residual = storedResidual(risk);
    const controlsCount = linkedControlCounts[risk.id] ?? 0;
    return {
      id: `risk-${risk.id}`,
      title: risk.title,
      detail: residual
        ? `Inherent ${inherent} (${inherentScore(risk)}) · Residual ${operatingBand(risk)} (${operatingScore(risk)}) · ${controlsCount} control${controlsCount === 1 ? "" : "s"}`
        : `Inherent ${inherent} (${inherentScore(risk)}) · Residual not assessed · ${controlsCount} control${controlsCount === 1 ? "" : "s"}`,
      href: `/risks/${risk.id}/edit`,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    headlines: [
      {
        label: "Above appetite",
        value: appetite.length,
        href: "/risks?appetiteBreach=true",
        tone: appetite.length > 0 ? "alert" : "default",
        hint: "Inherent band exceeds category appetite",
      },
      {
        label: "High / Critical risks",
        value: critical.length,
        href: "/risks?severity=High,Critical",
        tone: critical.length > 0 ? "alert" : "default",
        hint: "Open or monitoring",
      },
      {
        label: "Overdue key controls",
        value: overdueKey.length,
        href: "/controls?isKey=true&testingStatus=Overdue",
        tone: overdueKey.length > 0 ? "alert" : "default",
        hint: "Testing cadence lapsed",
      },
      {
        label: "Overdue issues",
        value: lateIssues.length,
        href: "/issues?overdue=true",
        tone: lateIssues.length > 0 ? "alert" : "default",
        hint: "Past target remediation date",
      },
      {
        label: "Severe open incidents",
        value: severeIncidents.length,
        href: "/incidents?status=open,investigating&severity=high,critical",
        tone: severeIncidents.length > 0 ? "alert" : "default",
        hint: "High or critical, still open",
      },
      {
        label: "Uncontrolled High/Critical",
        value: uncontrolledHigh.length,
        href: "/risks?uncontrolled=true&severity=High,Critical",
        tone: uncontrolledHigh.length > 0 ? "alert" : "default",
        hint: "No linked control",
      },
    ],
    appetiteBreaches: appetite.map(riskRow),
    criticalRisks: critical.map(riskRow),
    overdueKeyControls: overdueKey.map((control) => ({
      id: `control-${control.id}`,
      title: control.title,
      detail: "Key · testing overdue",
      href: `/controls/${control.id}/edit`,
    })),
    overdueIssues: lateIssues.map((issue) => ({
      id: `issue-${issue.id}`,
      title: issue.title,
      detail: `${issue.severity} · ${issue.status.replaceAll("_", " ")}`,
      href: `/issues/${issue.id}/edit`,
    })),
    openSevereIncidents: severeIncidents.map((incident) => ({
      id: `incident-${incident.id}`,
      title: incident.title,
      detail: `${incident.severity} · ${incident.status}`,
      href: `/incidents/${incident.id}/edit`,
    })),
  };
}

export function boardPackCsv(
  pack: BoardPack,
  sections: readonly BoardSectionId[] = BOARD_SECTION_IDS,
) {
  const visible = new Set(sections);
  const csvSections: Array<[BoardSectionId, string, BoardRow[]]> = [
    ["appetite", "Above appetite", pack.appetiteBreaches],
    ["criticalRisks", "High / Critical risks", pack.criticalRisks],
    ["overdueKeyControls", "Overdue key controls", pack.overdueKeyControls],
    ["overdueIssues", "Overdue issues", pack.overdueIssues],
    ["severeIncidents", "Severe open incidents", pack.openSevereIncidents],
  ];

  return csvSections
    .filter(([id]) => visible.has(id))
    .flatMap(([, section, rows]) =>
      rows.map((row) => [section, row.title, row.detail, row.href]),
    );
}
