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

  return new Date(lastReviewedAt).toLocaleDateString();
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
