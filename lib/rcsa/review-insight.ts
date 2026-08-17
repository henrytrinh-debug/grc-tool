import {
  getRiskScore,
  getSeverityBand,
  type SeverityBand,
} from "@/lib/dashboard/analytics";
import { getTestingStatus } from "@/lib/types/control";
import { isIssueOpen, isIssueOverdue } from "@/lib/types/issue";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedIssue,
} from "@/lib/types/linked-entities";

export type EvidenceTone = "ok" | "watch" | "alert";

export type EvidenceBrief = {
  headline: string;
  bullets: string[];
  tone: EvidenceTone;
};

export type IndicativeResidual = {
  inherentScore: number;
  inherentBand: SeverityBand;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  residualBand: SeverityBand;
  reduced: boolean;
  rationale: string;
};

type ReviewEvidence = {
  controls: LinkedControl[];
  incidents: LinkedIncident[];
  issues: LinkedIssue[];
};

/**
 * Short reviewer narrative so the RCSA page isn't just three disconnected
 * lists. Tone follows the worst signal: overdue/high findings, failed key
 * controls, then untested or uncontrolled exposure.
 */
export function buildEvidenceBrief({
  controls,
  incidents,
  issues,
}: ReviewEvidence): EvidenceBrief {
  const openIssues = issues.filter((issue) => isIssueOpen(issue.status));
  const overdueIssues = openIssues.filter((issue) => isIssueOverdue(issue));
  const highOpenIssues = openIssues.filter(
    (issue) => issue.severity === "high" || issue.severity === "critical",
  );
  const keyControls = controls.filter((control) => control.is_key);
  const ineffectiveKey = keyControls.filter(
    (control) => control.effectiveness === "ineffective",
  );
  const overdueControls = controls.filter(
    (control) => getTestingStatus(control.last_tested_at, control.is_key) === "Overdue",
  );
  const openIncidents = incidents.filter(
    (incident) => incident.status !== "resolved",
  );
  const highOpenIncidents = openIncidents.filter(
    (incident) =>
      incident.severity === "high" || incident.severity === "critical",
  );

  const bullets: string[] = [];
  let tone: EvidenceTone = "ok";

  if (controls.length === 0) {
    bullets.push("No linked controls — this risk is currently uncontrolled.");
    tone = "alert";
  } else {
    const keyLabel =
      keyControls.length > 0
        ? `${keyControls.length} key / ${controls.length} total`
        : `${controls.length} non-key`;
    bullets.push(
      `${keyLabel} control${controls.length === 1 ? "" : "s"} linked.`,
    );
  }

  if (ineffectiveKey.length > 0) {
    bullets.push(
      `${ineffectiveKey.length} key control${ineffectiveKey.length === 1 ? " is" : "s are"} rated ineffective.`,
    );
    tone = "alert";
  }

  if (overdueControls.length > 0) {
    bullets.push(
      `${overdueControls.length} control${overdueControls.length === 1 ? " is" : "s are"} overdue for testing.`,
    );
    if (tone === "ok") {
      tone = "watch";
    }
  }

  if (openIncidents.length === 0) {
    bullets.push(
      incidents.length === 0
        ? "No linked incidents on record."
        : "All linked incidents are resolved.",
    );
  } else {
    bullets.push(
      `${openIncidents.length} linked incident${openIncidents.length === 1 ? " is" : "s are"} still open${
        highOpenIncidents.length > 0
          ? `, including ${highOpenIncidents.length} high/critical`
          : ""
      }.`,
    );
    if (highOpenIncidents.length > 0) {
      tone = "alert";
    } else if (tone === "ok") {
      tone = "watch";
    }
  }

  if (openIssues.length === 0) {
    bullets.push(
      issues.length === 0
        ? "No linked issues — raise one if this review finds a gap."
        : "All linked issues are closed.",
    );
  } else {
    bullets.push(
      `${openIssues.length} open issue${openIssues.length === 1 ? "" : "s"}${
        overdueIssues.length > 0
          ? `, ${overdueIssues.length} overdue`
          : ""
      }${
        highOpenIssues.length > 0
          ? `, ${highOpenIssues.length} high/critical`
          : ""
      }.`,
    );
    if (overdueIssues.length > 0 || highOpenIssues.length > 0) {
      tone = "alert";
    } else if (tone === "ok") {
      tone = "watch";
    }
  }

  const headline =
    tone === "alert"
      ? "Evidence points to material residual exposure — challenge the current rating."
      : tone === "watch"
        ? "Mixed evidence — confirm the rating still matches how the risk is running."
        : "Evidence is currently quiet — confirm the rating still holds, then move on.";

  return { headline, bullets, tone };
}

/**
 * Indicative residual after controls. After 010 this is a starting point for
 * the stored residual the reviewer confirms; it is not written automatically.
 */
export function buildIndicativeResidual(
  likelihood: number,
  impact: number,
  controls: LinkedControl[],
): IndicativeResidual {
  const inherentScore = getRiskScore(likelihood, impact);
  const inherentBand = getSeverityBand(inherentScore);
  const reduction = controlLikelihoodReduction(controls);
  const residualLikelihood = Math.max(1, likelihood - reduction.steps);
  const residualScore = getRiskScore(residualLikelihood, impact);

  return {
    inherentScore,
    inherentBand,
    residualLikelihood,
    residualImpact: impact,
    residualScore,
    residualBand: getSeverityBand(residualScore),
    reduced: reduction.steps > 0,
    rationale: reduction.rationale,
  };
}

function controlLikelihoodReduction(controls: LinkedControl[]) {
  if (controls.length === 0) {
    return {
      steps: 0,
      rationale:
        "No linked controls, so indicative residual equals inherent exposure.",
    };
  }

  const keyControls = controls.filter((control) => control.is_key);
  const relevant = keyControls.length > 0 ? keyControls : controls;
  const scope = keyControls.length > 0 ? "key control" : "control";
  const ineffective = relevant.filter(
    (control) => control.effectiveness === "ineffective",
  );
  const untested = relevant.filter(
    (control) => control.effectiveness === "not_tested",
  );
  const effective = relevant.filter(
    (control) => control.effectiveness === "effective",
  );

  if (ineffective.length > 0) {
    return {
      steps: 0,
      rationale: `${ineffective.length} ineffective ${scope}${ineffective.length === 1 ? "" : "s"} — no reduction from inherent.`,
    };
  }

  if (untested.length > 0) {
    return {
      steps: 0,
      rationale: `${untested.length} ${scope}${untested.length === 1 ? " is" : "s are"} untested — residual is held at inherent until testing is complete.`,
    };
  }

  if (effective.length === relevant.length && effective.length > 0) {
    return {
      steps: 1,
      rationale: `All ${relevant.length} ${scope}${relevant.length === 1 ? "" : "s"} rated effective — indicative residual likelihood reduced by 1 (impact unchanged).`,
    };
  }

  return {
    steps: 0,
    rationale: "Control evidence is mixed — residual is held at inherent.",
  };
}
