"use client";

import { FormEvent, useState } from "react";
import { ErrorBanner, SchemaNotice, SectionCard } from "@/app/components/page-parts";
import {
  inputClassName,
  labelClassName,
  mutedTextClassName,
  primaryButtonClassName,
} from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import { validateSettings } from "@/lib/settings/store";
import type { AppSettings } from "@/lib/settings/defaults";
import { RISK_SCALE_VALUES } from "@/lib/types/risk";

const BANDS = ["Low", "Medium", "High", "Critical"] as const;
const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export type MethodologySection = "scoring" | "review" | "testing" | "issueDue";

export function MethodologySettings({
  sections,
}: {
  sections: MethodologySection[];
}) {
  const { settings, schemaReady, saveSettings } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateSettings(draft);
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveSettings(draft);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!schemaReady) {
    return (
      <SchemaNotice>
        Register methodology settings appear after{" "}
        <code className="font-mono">003_admin_settings.sql</code>.
      </SchemaNotice>
    );
  }

  return (
    <form onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-6">
      <ErrorBanner message={error} />
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      {sections.includes("scoring") ? (
        <SectionCard
          title="Risk rating definitions"
          description="ISO 31000-style 1–5 labels. These appear on the 5×5 picker, heat map, and register."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                Likelihood
              </p>
              <div className="space-y-2">
                {RISK_SCALE_VALUES.map((value) => (
                  <label key={`likelihood-${value}`} className="flex items-center gap-3">
                    <span className="w-6 text-sm text-slate-500">{value}</span>
                    <input
                      value={draft.likelihoodLabels[value]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          likelihoodLabels: {
                            ...current.likelihoodLabels,
                            [value]: event.target.value,
                          },
                        }))
                      }
                      className={inputClassName}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                Impact
              </p>
              <div className="space-y-2">
                {RISK_SCALE_VALUES.map((value) => (
                  <label key={`impact-${value}`} className="flex items-center gap-3">
                    <span className="w-6 text-sm text-slate-500">{value}</span>
                    <input
                      value={draft.impactLabels[value]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          impactLabels: {
                            ...current.impactLabels,
                            [value]: event.target.value,
                          },
                        }))
                      }
                      className={inputClassName}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
              Score bands (likelihood × impact, max 25)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["Low", "Medium", "High"] as const).map((band) => (
                <label key={band} className="flex flex-col gap-1">
                  <span className={labelClassName}>{band} up to</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={draft.bandMaxScores[band]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        bandMaxScores: {
                          ...current.bandMaxScores,
                          [band]: Number(event.target.value),
                        },
                      }))
                    }
                    className={inputClassName}
                  />
                </label>
              ))}
            </div>
            <p className={`mt-2 text-sm ${mutedTextClassName}`}>
              Critical is anything above the High threshold.
            </p>
          </div>
        </SectionCard>
      ) : null}

      {sections.includes("review") ? (
        <SectionCard
          title="Review cadence"
          description="How often a risk must be re-assessed by score band."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BANDS.map((band) => (
              <label key={band} className="flex flex-col gap-1">
                <span className={labelClassName}>{band} review (days)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.reviewCadenceDays[band]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      reviewCadenceDays: {
                        ...current.reviewCadenceDays,
                        [band]: Number(event.target.value),
                      },
                    }))
                  }
                  className={inputClassName}
                />
              </label>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {sections.includes("testing") ? (
        <SectionCard
          title="Testing cadence"
          description="How often key and non-key controls must be tested."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={labelClassName}>Key control testing (days)</span>
              <input
                type="number"
                min={1}
                value={draft.keyTestingCadenceDays}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    keyTestingCadenceDays: Number(event.target.value),
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClassName}>Non-key control testing (days)</span>
              <input
                type="number"
                min={1}
                value={draft.nonKeyTestingCadenceDays}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    nonKeyTestingCadenceDays: Number(event.target.value),
                  }))
                }
                className={inputClassName}
              />
            </label>
          </div>
        </SectionCard>
      ) : null}

      {sections.includes("issueDue") ? (
        <SectionCard
          title="Issue target dates"
          description="Default remediation window when a finding is raised, by severity."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ISSUE_SEVERITIES.map((severity) => (
              <label key={severity} className="flex flex-col gap-1">
                <span className={`${labelClassName} capitalize`}>
                  {severity} (days)
                </span>
                <input
                  type="number"
                  min={1}
                  value={draft.issueDueDays[severity]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      issueDueDays: {
                        ...current.issueDueDays,
                        [severity]: Number(event.target.value),
                      },
                    }))
                  }
                  className={inputClassName}
                />
              </label>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div>
        <button type="submit" disabled={saving} className={primaryButtonClassName}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
