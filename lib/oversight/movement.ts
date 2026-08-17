import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import type { RcsaReview } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

export type RatingMove = {
  riskId: string;
  title: string;
  reviewedAt: string;
  previousScore: number;
  finalScore: number;
  delta: number;
  previousBand: string;
  finalBand: string;
};

export type RatingMovementSummary = {
  reviewed: number;
  increased: number;
  decreased: number;
  unchanged: number;
  moves: RatingMove[];
};

/**
 * Latest RCSA per risk where the confirmed score differs from the incoming
 * score — the 2LoD view of whether assessments are tightening or loosening.
 */
export function buildRatingMovement(
  reviews: RcsaReview[],
  risks: Risk[],
): RatingMovementSummary {
  const titleById = new Map(risks.map((risk) => [risk.id, risk.title]));
  const latest = new Map<string, RcsaReview>();

  for (const review of reviews) {
    const current = latest.get(review.risk_id);
    if (!current || review.reviewed_at > current.reviewed_at) {
      latest.set(review.risk_id, review);
    }
  }

  const moves: RatingMove[] = [];
  let increased = 0;
  let decreased = 0;
  let unchanged = 0;

  for (const review of latest.values()) {
    const previousScore = getRiskScore(
      review.previous_likelihood,
      review.previous_impact,
    );
    const finalScore = getRiskScore(
      review.final_likelihood,
      review.final_impact,
    );
    const delta = finalScore - previousScore;

    if (delta > 0) {
      increased += 1;
    } else if (delta < 0) {
      decreased += 1;
    } else {
      unchanged += 1;
    }

    if (delta === 0) {
      continue;
    }

    moves.push({
      riskId: review.risk_id,
      title: titleById.get(review.risk_id) ?? "Untitled risk",
      reviewedAt: review.reviewed_at,
      previousScore,
      finalScore,
      delta,
      previousBand: getSeverityBand(previousScore),
      finalBand: getSeverityBand(finalScore),
    });
  }

  return {
    reviewed: latest.size,
    increased,
    decreased,
    unchanged,
    moves: moves.sort(
      (left, right) =>
        Math.abs(right.delta) - Math.abs(left.delta) ||
        right.reviewedAt.localeCompare(left.reviewedAt),
    ),
  };
}
