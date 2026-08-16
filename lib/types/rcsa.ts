import {
  getRiskScore,
  getSeverityBand,
  type SeverityBand,
} from "@/lib/dashboard/analytics";
import { daysSinceIso, formatIsoDate } from "@/lib/dates";

export type RcsaSession = {
  id: string;
  owner_id?: string;
  owner_email?: string;
  created_at?: string;
};

export type RcsaReview = {
  id: string;
  session_id: string;
  risk_id: string;
  reviewed_at: string;
  previous_likelihood: number;
  previous_impact: number;
  final_likelihood: number;
  final_impact: number;
  ai_recommended_likelihood?: number | null;
  ai_recommended_impact?: number | null;
  ai_rationale?: string | null;
  owner_id?: string;
  owner_email?: string;
  created_at?: string;
};

export type NewRcsaReview = {
  session_id: string;
  risk_id: string;
  previous_likelihood: number;
  previous_impact: number;
  final_likelihood: number;
  final_impact: number;
};

export type RiskWithLastReviewed = {
  id: string;
  title: string;
  likelihood: number;
  impact: number;
  owner_email?: string;
  lastReviewedAt: string | null;
};

export function formatLastReviewedAt(
  lastReviewedAt: string | null | undefined,
) {
  if (!lastReviewedAt) {
    return "Never reviewed";
  }

  return formatIsoDate(lastReviewedAt);
}

/** How often a risk should be re-assessed, by inherent severity band. */
export const REVIEW_CADENCE_DAYS: Record<SeverityBand, number> = {
  Critical: 90,
  High: 180,
  Medium: 365,
  Low: 365,
};

export function getReviewCadenceDays(likelihood: number, impact: number) {
  return REVIEW_CADENCE_DAYS[
    getSeverityBand(getRiskScore(likelihood, impact))
  ];
}

/** True when the risk has never been reviewed, or the band's cadence has lapsed. */
export function isReviewDue(
  lastReviewedAt: string | null | undefined,
  likelihood: number,
  impact: number,
) {
  if (!lastReviewedAt) {
    return true;
  }

  return daysSinceIso(lastReviewedAt) > getReviewCadenceDays(likelihood, impact);
}

export type ReviewRecencyBucket =
  | "never"
  | "within180"
  | "between180And365"
  | "over365";

/** Calendar recency buckets used by Oversight's aging breakdown. */
export function getReviewRecencyBucket(
  lastReviewedAt: string | null | undefined,
): ReviewRecencyBucket {
  if (!lastReviewedAt) {
    return "never";
  }

  const daysSince = daysSinceIso(lastReviewedAt);

  if (daysSince > 365) {
    return "over365";
  }

  if (daysSince > 180) {
    return "between180And365";
  }

  return "within180";
}

export function buildLastReviewedByRisk(
  reviews: Pick<RcsaReview, "risk_id" | "reviewed_at">[],
) {
  const lastReviewedByRisk: Record<string, string> = {};

  for (const review of reviews) {
    const current = lastReviewedByRisk[review.risk_id];

    if (!current || review.reviewed_at > current) {
      lastReviewedByRisk[review.risk_id] = review.reviewed_at;
    }
  }

  return lastReviewedByRisk;
}

export function toRcsaReviewInsertPayload(
  review: NewRcsaReview,
  owner: { id: string; email: string },
) {
  return {
    session_id: review.session_id,
    risk_id: review.risk_id,
    previous_likelihood: review.previous_likelihood,
    previous_impact: review.previous_impact,
    final_likelihood: review.final_likelihood,
    final_impact: review.final_impact,
    ai_recommended_likelihood: null,
    ai_recommended_impact: null,
    ai_rationale: null,
    reviewed_at: new Date().toISOString(),
    owner_id: owner.id,
    owner_email: owner.email,
  };
}
