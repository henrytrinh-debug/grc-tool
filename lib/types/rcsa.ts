import {
  getRiskScore,
  getSeverityBand,
} from "@/lib/dashboard/analytics";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { getSettings } from "@/lib/settings/store";
import { addDaysToIsoDate, daysSinceIso, formatIsoDate, todayIsoDate } from "@/lib/dates";

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
  previous_residual_likelihood?: number | null;
  previous_residual_impact?: number | null;
  final_residual_likelihood?: number | null;
  final_residual_impact?: number | null;
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
  previous_residual_likelihood?: number | null;
  previous_residual_impact?: number | null;
  final_residual_likelihood?: number | null;
  final_residual_impact?: number | null;
};

export type RiskWithLastReviewed = {
  id: string;
  title: string;
  likelihood: number;
  impact: number;
  residual_likelihood?: number | null;
  residual_impact?: number | null;
  owner_email?: string;
  category_id?: string | null;
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
export const REVIEW_CADENCE_DAYS = DEFAULT_SETTINGS.reviewCadenceDays;

export function getReviewCadenceDays(likelihood: number, impact: number) {
  const band = getSeverityBand(getRiskScore(likelihood, impact));
  return getSettings().reviewCadenceDays[band];
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

export function getNextReviewDueDate(
  lastReviewedAt: string | null | undefined,
  likelihood: number,
  impact: number,
) {
  if (!lastReviewedAt) {
    return todayIsoDate();
  }

  const reviewedDate = lastReviewedAt.slice(0, 10);
  return addDaysToIsoDate(
    reviewedDate,
    getReviewCadenceDays(likelihood, impact),
  );
}

export function formatNextReviewDue(
  lastReviewedAt: string | null | undefined,
  likelihood: number,
  impact: number,
) {
  if (isReviewDue(lastReviewedAt, likelihood, impact)) {
    return lastReviewedAt ? "Overdue" : "Due now";
  }

  return formatIsoDate(getNextReviewDueDate(lastReviewedAt, likelihood, impact));
}

export function toRcsaReviewInsertPayload(
  review: NewRcsaReview,
  owner: { id: string; email: string },
  options: { includeResidual?: boolean } = {},
) {
  return {
    session_id: review.session_id,
    risk_id: review.risk_id,
    previous_likelihood: review.previous_likelihood,
    previous_impact: review.previous_impact,
    final_likelihood: review.final_likelihood,
    final_impact: review.final_impact,
    ...(options.includeResidual
      ? {
          previous_residual_likelihood: review.previous_residual_likelihood ?? null,
          previous_residual_impact: review.previous_residual_impact ?? null,
          final_residual_likelihood: review.final_residual_likelihood ?? null,
          final_residual_impact: review.final_residual_impact ?? null,
        }
      : {}),
    ai_recommended_likelihood: null,
    ai_recommended_impact: null,
    ai_rationale: null,
    reviewed_at: new Date().toISOString(),
    owner_id: owner.id,
    owner_email: owner.email,
  };
}
