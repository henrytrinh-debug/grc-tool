import { inherentBand, inherentScore, operatingBand, operatingScore, storedResidual } from "@/lib/risk/ratings";
import { buildRatingMovement } from "@/lib/oversight/movement";
import {
  appetiteBreachingRisks,
  highCriticalRisks,
  ineffectiveControls,
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
import type { FollowUp } from "@/lib/types/follow-up";
import {
  entityHref,
  formatFollowUpTrigger,
  isFollowUpOpen,
} from "@/lib/types/follow-up";
import type { RcsaReview } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

export const BOARD_LIST_LIMIT = 5;
export const BOARD_MATTERS_LIMIT = 8;

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
  matters: BoardRow[];
  decisions: BoardRow[];
  controlFailures: BoardRow[];
  openSevereIncidents: BoardRow[];
  appetiteBreaches: BoardRow[];
  movementSentence: string;
};

function riskRow(risk: Risk, linkedControlCounts: Record<string, number>): BoardRow {
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

export function boardMovementSentence(input: {
  reviews?: RcsaReview[];
  risks: Risk[];
}) {
  if (!input.reviews || input.reviews.length === 0) {
    return "No risk assessments in this pack to compare ratings against.";
  }

  const movement = buildRatingMovement(input.reviews, input.risks);
  if (movement.increased === 0 && movement.decreased === 0) {
    return `Latest assessments left ${movement.unchanged} rating${movement.unchanged === 1 ? "" : "s"} unchanged.`;
  }

  return `${movement.increased} rating${movement.increased === 1 ? "" : "s"} increased and ${movement.decreased} decreased versus the previous assessment.`;
}

export function buildBoardPack(input: {
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
  categories: RiskCategory[];
  linkedControlCounts: Record<string, number>;
  followUps?: FollowUp[];
  reviews?: RcsaReview[];
}): BoardPack {
  const { risks, controls, incidents, categories, linkedControlCounts } = input;

  const appetite = appetiteBreachingRisks(risks, categories);
  const critical = highCriticalRisks(risks);
  const failures = ineffectiveControls(controls);
  const severeIncidents = severeOpenIncidents(incidents);
  const uncontrolledHigh = uncontrolledHighCriticalRisks(
    risks,
    linkedControlCounts,
  );
  const openFollowUps = (input.followUps ?? []).filter((followUp) =>
    isFollowUpOpen(followUp.status),
  );

  const decisions = openFollowUps.map((followUp) => ({
    id: `follow-up-${followUp.id}`,
    title: followUp.title,
    detail: `${formatFollowUpTrigger(followUp.trigger_type)} · ${followUp.status.replaceAll("_", " ")}`,
    href: entityHref(followUp.entity_type, followUp.entity_id),
  }));

  const controlFailures = failures.map((control) => ({
    id: `control-${control.id}`,
    title: control.title,
    detail: `${control.is_key ? "Key" : "Non-key"} · latest test ineffective`,
    href: `/controls/${control.id}/edit`,
  }));

  const incidentRows = severeIncidents.map((incident) => ({
    id: `incident-${incident.id}`,
    title: incident.title,
    detail: `${incident.severity} · ${incident.status} — confirm residual on linked risks`,
    href: `/incidents/${incident.id}/edit`,
  }));

  const matters: BoardRow[] = [];
  const seen = new Set<string>();

  function pushMatter(row: BoardRow, why: string) {
    if (seen.has(row.id) || matters.length >= BOARD_MATTERS_LIMIT) {
      return;
    }
    seen.add(row.id);
    matters.push({ ...row, detail: why });
  }

  for (const risk of appetite) {
    pushMatter(
      riskRow(risk, linkedControlCounts),
      `Operating ${operatingBand(risk)} sits above category appetite.`,
    );
  }
  for (const risk of uncontrolledHigh) {
    pushMatter(
      riskRow(risk, linkedControlCounts),
      `High/Critical with no linked control — residual credit is not justified.`,
    );
  }
  for (const control of failures.filter((item) => item.is_key)) {
    pushMatter(
      {
        id: `control-${control.id}`,
        title: control.title,
        detail: "",
        href: `/controls/${control.id}/edit`,
      },
      "Key control tested ineffective — treatment and residual need a decision.",
    );
  }
  for (const incident of severeIncidents) {
    pushMatter(
      {
        id: `incident-${incident.id}`,
        title: incident.title,
        detail: "",
        href: `/incidents/${incident.id}/edit`,
      },
      `Severe incident still ${incident.status}.`,
    );
  }
  for (const followUp of openFollowUps) {
    pushMatter(
      {
        id: `follow-up-${followUp.id}`,
        title: followUp.title,
        detail: "",
        href: entityHref(followUp.entity_type, followUp.entity_id),
      },
      `${formatFollowUpTrigger(followUp.trigger_type)} awaiting ${followUp.status === "pending_approval" ? "approval" : "action"}.`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    headlines: [
      {
        label: "Above appetite",
        value: appetite.length,
        href: "/risks?appetiteBreach=true",
        tone: appetite.length > 0 ? "alert" : "default",
        hint: "Operating band exceeds category appetite",
      },
      {
        label: "Material High / Critical",
        value: critical.length,
        href: "/risks?severity=High,Critical",
        tone: critical.length > 0 ? "alert" : "default",
        hint: "Residual if assessed, otherwise inherent",
      },
      {
        label: "Control failures",
        value: failures.length,
        href: "/controls?effectiveness=ineffective",
        tone: failures.length > 0 ? "alert" : "default",
        hint: "Latest test recorded ineffective",
      },
      {
        label: "Decisions required",
        value: openFollowUps.length,
        href: "/feedback",
        tone: openFollowUps.length > 0 ? "alert" : "default",
        hint: "Open follow-ups from incidents, issues, tests, and rating changes",
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
    matters,
    decisions,
    controlFailures,
    openSevereIncidents: incidentRows,
    appetiteBreaches: appetite.map((risk) => riskRow(risk, linkedControlCounts)),
    movementSentence: boardMovementSentence({
      reviews: input.reviews,
      risks,
    }),
  };
}

export function boardPackCsv(
  pack: BoardPack,
  sections: readonly BoardSectionId[] = BOARD_SECTION_IDS,
) {
  const visible = new Set(sections);
  const csvSections: Array<[BoardSectionId, string, BoardRow[]]> = [
    ["matters", "Matters for attention", pack.matters],
    ["decisions", "Decisions required", pack.decisions],
    ["controlFailures", "Control failures", pack.controlFailures],
    ["severeIncidents", "Severe open incidents", pack.openSevereIncidents],
    ["appetite", "Above appetite", pack.appetiteBreaches],
  ];

  return csvSections
    .filter(([id]) => visible.has(id))
    .flatMap(([, section, rows]) =>
      rows.map((row) => [section, row.title, row.detail, row.href]),
    );
}
