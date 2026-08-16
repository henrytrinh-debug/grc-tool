"use client";

import { FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
  SectionCard,
} from "@/app/components/page-parts";
import {
  dangerButtonClassName,
  inputClassName,
  labelClassName,
  mutedTextClassName,
  pageClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import {
  removeDemonstrationData,
  seedDemonstrationData,
} from "@/lib/admin/demo-data";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings/defaults";
import { useSettings } from "@/lib/settings/context";
import { RISK_SCALE_VALUES } from "@/lib/types/risk";

const BANDS = ["Low", "Medium", "High", "Critical"] as const;
const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export default function AdminPage() {
  const { user, authLoading } = useRequireAuth();
  const { loading } = useSettings();

  if (authLoading || loading || !user) {
    return <PageLoading />;
  }

  return <AdminSettings user={user} />;
}

function AdminSettings({ user }: { user: User }) {
  const {
    settings,
    categories,
    schemaReady,
    demoIds,
    saveSettings,
    addCategory,
    updateCategory,
    deleteCategory,
    setDemoIds,
    reload,
  } = useSettings();

  const [draft, setDraft] = useState<AppSettings>(settings);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await saveSettings(draft);
      setMessage("Settings saved. Scoring, cadence, and labels now apply across the tool.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryName.trim()) {
      return;
    }

    setError(null);
    try {
      await addCategory(categoryName, categoryDescription);
      setCategoryName("");
      setCategoryDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  async function handleSeed() {
    if (!user?.email) {
      setError("User email not available");
      return;
    }

    if (demoIds) {
      setError(
        "Demonstration data is already loaded. Remove it first if you want a fresh set.",
      );
      return;
    }

    setSeeding(true);
    setError(null);
    setMessage(null);

    try {
      const ids = await seedDemonstrationData({
        id: user.id,
        email: user.email,
      });
      await setDemoIds(ids);
      await reload();
      setMessage(
        "Demonstration data loaded. Open Home, the risk register, and Oversight to walk the story.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load demonstration data",
      );
    } finally {
      setSeeding(false);
    }
  }

  async function handleRemoveDemo() {
    if (!demoIds || !user) {
      return;
    }

    const confirmed = window.confirm(
      "Remove the demonstration records? Your own data is left untouched.",
    );
    if (!confirmed) {
      return;
    }

    setSeeding(true);
    setError(null);
    setMessage(null);

    try {
      await removeDemonstrationData(user.id, demoIds);
      await setDemoIds(null);
      await reload();
      setMessage("Demonstration data removed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove demonstration data",
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className={pageClassName}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <PageHeader
          title="Admin"
          description="Configure how this organisation scores risk, how often it reviews and tests, and the taxonomy used on the register."
        />

        {!schemaReady && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Run <code className="font-mono">supabase/schema/003_admin_settings.sql</code>{" "}
            in the Supabase SQL editor to enable saved settings, taxonomy, and
            demonstration data. Until then, built-in defaults are used.
          </p>
        )}

        <ErrorBanner message={error} />
        {message && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </p>
        )}

        <form onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-8">
          <SectionCard
            title="Organisation"
            description="Shown in the sidebar and used when you export or present the registers."
          >
            <label className="flex max-w-lg flex-col gap-1">
              <span className={labelClassName}>Organisation name</span>
              <input
                value={draft.organizationName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    organizationName: event.target.value,
                  }))
                }
                className={inputClassName}
              />
            </label>
          </SectionCard>

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

          <SectionCard
            title="Review and testing cadence"
            description="How often a risk must be re-assessed by score band, and how often controls must be tested."
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                <span className={labelClassName}>
                  Non-key control testing (days)
                </span>
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || !schemaReady}
              className={primaryButtonClassName}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setDraft(DEFAULT_SETTINGS)}
            >
              Reset form to defaults
            </button>
          </div>
        </form>

        <SectionCard
          title="Risk taxonomy"
          description="Categories used on the risk register. Unlinking a category from Admin leaves existing risks uncategorised."
        >
          <form
            onSubmit={(event) => void handleAddCategory(event)}
            className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Category name"
              className={inputClassName}
              disabled={!schemaReady}
            />
            <input
              value={categoryDescription}
              onChange={(event) => setCategoryDescription(event.target.value)}
              placeholder="Short description"
              className={inputClassName}
              disabled={!schemaReady}
            />
            <button
              type="submit"
              disabled={!schemaReady || !categoryName.trim()}
              className={secondaryButtonClassName}
            >
              Add
            </button>
          </form>

          {categories.length === 0 ? (
            <p className={`text-sm ${mutedTextClassName}`}>
              No categories yet. Add Cybersecurity, Operational, Financial, or
              load demonstration data.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                      {category.name}
                    </p>
                    {category.description && (
                      <p className={`text-sm ${mutedTextClassName}`}>
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => {
                        const name = window.prompt("Category name", category.name);
                        if (!name?.trim()) {
                          return;
                        }
                        const description = window.prompt(
                          "Description",
                          category.description,
                        );
                        void updateCategory(category.id, {
                          name,
                          description: description ?? category.description,
                        }).catch((err: unknown) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Failed to update category",
                          ),
                        );
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${category.name}”? Risks in this category become uncategorised.`,
                          )
                        ) {
                          void deleteCategory(category.id).catch(
                            (err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to delete category",
                              ),
                          );
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Demonstration data"
          description="Load a sample environment — taxonomy, scored risks, mixed control tests, an open critical incident, and findings in flight — to walk the product."
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!schemaReady || seeding}
              onClick={() => void handleSeed()}
              className={primaryButtonClassName}
            >
              {seeding ? "Working..." : "Load demonstration data"}
            </button>
            <button
              type="button"
              disabled={!schemaReady || seeding || !demoIds}
              onClick={() => void handleRemoveDemo()}
              className={dangerButtonClassName}
            >
              Remove demonstration data
            </button>
          </div>
          <p className={`mt-3 text-sm ${mutedTextClassName}`}>
            {demoIds
              ? "A demonstration set is currently loaded for this account."
              : "No demonstration set is recorded for this account."}
          </p>
        </SectionCard>
      </main>
    </div>
  );
}
