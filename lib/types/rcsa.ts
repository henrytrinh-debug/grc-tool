export type RcsaSessionStatus = "in_progress" | "completed";

export type RcsaSession = {
  id: string;
  status: RcsaSessionStatus;
  owner_id?: string;
  owner_email?: string;
  created_at?: string;
  completed_at?: string | null;
};

export type RcsaReview = {
  id: string;
  session_id?: string | null;
  risk_id: string;
  reviewed_at: string;
  likelihood?: number | null;
  impact?: number | null;
  notes?: string | null;
  owner_id?: string;
  owner_email?: string;
  created_at?: string;
};

export type RiskWithLastReviewed = {
  id: string;
  title: string;
  likelihood: number;
  impact: number;
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
