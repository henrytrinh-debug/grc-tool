import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type OrgSettingsRow,
  type ScaleLabels,
} from "@/lib/settings/defaults";
import {
  parseWorkspacePreferences,
  workspacePreferencesToJson,
} from "@/lib/settings/preferences";
import type { RiskScaleValue } from "@/lib/types/risk";

let currentSettings: AppSettings = DEFAULT_SETTINGS;

export function getSettings() {
  return currentSettings;
}

export function formatReviewCadenceHint(settings: AppSettings = getSettings()) {
  const days = settings.reviewCadenceDays;
  return `Critical every ${days.Critical} days, High every ${days.High} days, Medium/Low every ${days.Medium}/${days.Low} days`;
}

export function formatTestingCadenceHint(settings: AppSettings = getSettings()) {
  return `Key controls: ${settings.keyTestingCadenceDays} days · others: ${settings.nonKeyTestingCadenceDays} days`;
}

export function formatKeyTestingCadenceHint(
  settings: AppSettings = getSettings(),
) {
  return `Key controls not tested within ${settings.keyTestingCadenceDays} days`;
}

export function hydrateSettings(settings: AppSettings) {
  currentSettings = settings;
}

export function validateSettings(settings: AppSettings): string | null {
  if (!settings.organizationName.trim()) {
    return "Organisation name is required.";
  }

  for (const value of [1, 2, 3, 4, 5] as const) {
    if (
      !settings.likelihoodLabels[value]?.trim() ||
      !settings.impactLabels[value]?.trim()
    ) {
      return "Every likelihood and impact rating needs a label.";
    }
  }

  const { Low, Medium, High } = settings.bandMaxScores;
  if (
    Low < 1 ||
    Medium < 1 ||
    High < 1 ||
    High > 24 ||
    Low >= Medium ||
    Medium >= High
  ) {
    return "Score bands must increase (Low < Medium < High) and stay between 1 and 24.";
  }

  if (
    Object.values(settings.reviewCadenceDays).some(
      (days) => !Number.isFinite(days) || days < 1,
    )
  ) {
    return "Review cadence must be at least 1 day for every score band.";
  }

  if (
    !Number.isFinite(settings.keyTestingCadenceDays) ||
    settings.keyTestingCadenceDays < 1 ||
    !Number.isFinite(settings.nonKeyTestingCadenceDays) ||
    settings.nonKeyTestingCadenceDays < 1
  ) {
    return "Control testing cadence must be at least 1 day.";
  }

  if (
    Object.values(settings.issueDueDays).some(
      (days) => !Number.isFinite(days) || days < 1,
    )
  ) {
    return "Issue target dates must be at least 1 day.";
  }

  return null;
}

function asScaleLabels(
  value: unknown,
  fallback: ScaleLabels,
): ScaleLabels {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const labels = { ...fallback };

  for (const key of [1, 2, 3, 4, 5] as RiskScaleValue[]) {
    const label = record[String(key)];
    if (typeof label === "string" && label.trim()) {
      labels[key] = label.trim();
    }
  }

  return labels;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.round(parsed);
}

export function settingsFromRow(row: OrgSettingsRow): AppSettings {
  const defaults = DEFAULT_SETTINGS;

  return {
    organizationName: row.organization_name?.trim() || defaults.organizationName,
    likelihoodLabels: asScaleLabels(
      row.likelihood_labels,
      defaults.likelihoodLabels,
    ),
    impactLabels: asScaleLabels(row.impact_labels, defaults.impactLabels),
    bandMaxScores: {
      Low: positiveInt(row.band_max_low, defaults.bandMaxScores.Low),
      Medium: positiveInt(row.band_max_medium, defaults.bandMaxScores.Medium),
      High: positiveInt(row.band_max_high, defaults.bandMaxScores.High),
      Critical: 25,
    },
    reviewCadenceDays: {
      Low: positiveInt(row.review_cadence_low, defaults.reviewCadenceDays.Low),
      Medium: positiveInt(
        row.review_cadence_medium,
        defaults.reviewCadenceDays.Medium,
      ),
      High: positiveInt(row.review_cadence_high, defaults.reviewCadenceDays.High),
      Critical: positiveInt(
        row.review_cadence_critical,
        defaults.reviewCadenceDays.Critical,
      ),
    },
    keyTestingCadenceDays: positiveInt(
      row.key_testing_cadence_days,
      defaults.keyTestingCadenceDays,
    ),
    nonKeyTestingCadenceDays: positiveInt(
      row.non_key_testing_cadence_days,
      defaults.nonKeyTestingCadenceDays,
    ),
    issueDueDays: {
      critical: positiveInt(row.issue_due_critical, defaults.issueDueDays.critical),
      high: positiveInt(row.issue_due_high, defaults.issueDueDays.high),
      medium: positiveInt(row.issue_due_medium, defaults.issueDueDays.medium),
      low: positiveInt(row.issue_due_low, defaults.issueDueDays.low),
    },
    workspacePreferences: parseWorkspacePreferences(row.workspace_preferences),
  };
}

export function settingsToRow(
  settings: AppSettings,
  options?: { includePreferences?: boolean },
) {
  return {
    organization_name: settings.organizationName.trim(),
    likelihood_labels: settings.likelihoodLabels,
    impact_labels: settings.impactLabels,
    band_max_low: settings.bandMaxScores.Low,
    band_max_medium: settings.bandMaxScores.Medium,
    band_max_high: settings.bandMaxScores.High,
    review_cadence_low: settings.reviewCadenceDays.Low,
    review_cadence_medium: settings.reviewCadenceDays.Medium,
    review_cadence_high: settings.reviewCadenceDays.High,
    review_cadence_critical: settings.reviewCadenceDays.Critical,
    key_testing_cadence_days: settings.keyTestingCadenceDays,
    non_key_testing_cadence_days: settings.nonKeyTestingCadenceDays,
    issue_due_critical: settings.issueDueDays.critical,
    issue_due_high: settings.issueDueDays.high,
    issue_due_medium: settings.issueDueDays.medium,
    issue_due_low: settings.issueDueDays.low,
    updated_at: new Date().toISOString(),
    ...(options?.includePreferences
      ? {
          workspace_preferences: workspacePreferencesToJson(
            settings.workspacePreferences,
          ),
        }
      : {}),
  };
}

export function isMissingRelationError(error: { message?: string; code?: string }) {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}
