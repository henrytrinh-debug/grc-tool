import type { IssueSeverity } from "@/lib/types/issue";
import type { RiskScaleValue } from "@/lib/types/risk";

export type ScaleLabels = Record<RiskScaleValue, string>;

export type BandMaxScores = {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
};

export type ReviewCadenceDays = BandMaxScores;

export type IssueDueDays = Record<IssueSeverity, number>;

export type AppSettings = {
  organizationName: string;
  likelihoodLabels: ScaleLabels;
  impactLabels: ScaleLabels;
  bandMaxScores: BandMaxScores;
  reviewCadenceDays: ReviewCadenceDays;
  keyTestingCadenceDays: number;
  nonKeyTestingCadenceDays: number;
  issueDueDays: IssueDueDays;
};

export const DEFAULT_SETTINGS: AppSettings = {
  organizationName: "My organisation",
  likelihoodLabels: {
    1: "Rare",
    2: "Unlikely",
    3: "Possible",
    4: "Likely",
    5: "Almost certain",
  },
  impactLabels: {
    1: "Negligible",
    2: "Minor",
    3: "Moderate",
    4: "Major",
    5: "Severe",
  },
  bandMaxScores: {
    Low: 5,
    Medium: 10,
    High: 19,
    Critical: 25,
  },
  reviewCadenceDays: {
    Low: 365,
    Medium: 365,
    High: 180,
    Critical: 90,
  },
  keyTestingCadenceDays: 180,
  nonKeyTestingCadenceDays: 365,
  issueDueDays: {
    critical: 30,
    high: 60,
    medium: 90,
    low: 180,
  },
};

export type RiskCategory = {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  owner_id?: string;
  owner_email?: string;
};

export type OrgSettingsRow = {
  owner_id: string;
  owner_email?: string | null;
  organization_name: string;
  likelihood_labels: ScaleLabels;
  impact_labels: ScaleLabels;
  band_max_low: number;
  band_max_medium: number;
  band_max_high: number;
  review_cadence_low: number;
  review_cadence_medium: number;
  review_cadence_high: number;
  review_cadence_critical: number;
  key_testing_cadence_days: number;
  non_key_testing_cadence_days: number;
  issue_due_critical: number;
  issue_due_high: number;
  issue_due_medium: number;
  issue_due_low: number;
  demo_ids?: DemoIds | null;
};

export type DemoIds = {
  categoryIds: string[];
  riskIds: string[];
  controlIds: string[];
  incidentIds: string[];
  issueIds: string[];
  sessionIds: string[];
};
