"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
} from "@/app/components/page-parts";
import { SeverityBandBadge } from "@/app/components/status-badge";
import { FilterSelect, listInputClassName } from "@/app/components/list-toolbar";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { sortRisksByExposure } from "@/lib/list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { operatingBand, storedResidual } from "@/lib/risk/ratings";
import { useSettings } from "@/lib/settings/context";
import { formatReviewCadenceHint } from "@/lib/settings/store";
import { categoryFilterOptions, matchesCategoryFilter } from "@/lib/taxonomy";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  buildLastReviewedByRisk,
  formatLastReviewedAt,
  getReviewCadenceDays,
  isReviewDue,
  type RcsaReview,
  type RiskWithLastReviewed,
} from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

export default function RcsaStartPage() {
  const router = useRouter();
  const { settings, categories, schemaReady, residualReady } = useSettings();
  const [risks, setRisks] = useState<RiskWithLastReviewed[]>([]);
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(
    new Set(),
  );
  const [filterText, setFilterText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChecklist = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [risksResult, reviewsResult] = await Promise.all([
        supabase
          .from("risks")
          .select("*")
          .eq("owner_id", ownerId)
          .order("title", { ascending: true }),
        supabase
          .from("rcsa_reviews")
          .select("risk_id, reviewed_at")
          .eq("owner_id", ownerId),
      ]);

      throwIfAnyQueryError([risksResult, reviewsResult]);

      const lastReviewedByRisk = buildLastReviewedByRisk(
        (reviewsResult.data ?? []) as Pick<
          RcsaReview,
          "risk_id" | "reviewed_at"
        >[],
      );

      const checklist = sortRisksByExposure(
        ((risksResult.data ?? []) as Risk[]).filter(
          (risk) => risk.status !== "closed",
        ),
      ).map((risk) => ({
        id: risk.id,
        title: risk.title,
        likelihood: risk.likelihood,
        impact: risk.impact,
        residual_likelihood: risk.residual_likelihood,
        residual_impact: risk.residual_impact,
        owner_email: risk.owner_email,
        category_id: risk.category_id,
        lastReviewedAt: lastReviewedByRisk[risk.id] ?? null,
      }));

      setRisks(checklist);
      setSelectedRiskIds(
        new Set(
          checklist
            .filter((risk) =>
              isReviewDue(risk.lastReviewedAt, risk.likelihood, risk.impact),
            )
            .map((risk) => risk.id),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load risk assessment checklist",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { user, authLoading } = useRequireAuth(fetchChecklist);

  const filteredRisks = useMemo(() => {
    const query = filterText.trim().toLowerCase();

    return risks.filter((risk) => {
      if (!matchesCategoryFilter(risk.category_id, categoryId)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const title = risk.title.toLowerCase();
      const owner = (risk.owner_email ?? "").toLowerCase();
      return title.includes(query) || owner.includes(query);
    });
  }, [categoryId, filterText, risks]);

  const visibleSelectedCount = useMemo(
    () => filteredRisks.filter((risk) => selectedRiskIds.has(risk.id)).length,
    [filteredRisks, selectedRiskIds],
  );

  const someSelected = selectedRiskIds.size > 0;

  const selectedCountLabel = useMemo(() => {
    if (risks.length === 0) {
      return "No risks available";
    }

    if (filterText.trim()) {
      return `${visibleSelectedCount} of ${filteredRisks.length} shown selected · ${selectedRiskIds.size} total selected`;
    }

    return `${selectedRiskIds.size} of ${risks.length} selected`;
  }, [
    filterText,
    filteredRisks.length,
    risks.length,
    selectedRiskIds.size,
    visibleSelectedCount,
  ]);

  function toggleRisk(riskId: string) {
    setSelectedRiskIds((current) => {
      const next = new Set(current);

      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }

      return next;
    });
  }

  function selectDueForReview() {
    setSelectedRiskIds(
      new Set(
        risks
          .filter((risk) =>
            isReviewDue(risk.lastReviewedAt, risk.likelihood, risk.impact),
          )
          .map((risk) => risk.id),
      ),
    );
  }

  function selectAllVisible() {
    setSelectedRiskIds((current) => {
      const next = new Set(current);
      for (const risk of filteredRisks) {
        next.add(risk.id);
      }
      return next;
    });
  }

  function deselectAllVisible() {
    setSelectedRiskIds((current) => {
      const next = new Set(current);
      for (const risk of filteredRisks) {
        next.delete(risk.id);
      }
      return next;
    });
  }

  async function handleStartReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || selectedRiskIds.size === 0) {
      return;
    }

    if (!user.email) {
      setError("User email not available");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: insertError } = await supabase
        .from("rcsa_sessions")
        .insert({
          owner_id: user.id,
          owner_email: user.email,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!data?.id) {
        throw new Error("Failed to create risk assessment session");
      }

      const riskIds = Array.from(selectedRiskIds).join(",");
      router.push(`/rcsa/review?session=${data.id}&risks=${riskIds}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start risk assessment",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8">
        <PageHeader
          title="Risk Assessment"
          description={`Risks due for review (by inherent severity cadence) are pre-selected. Each sitting confirms inherent, links evidence, then confirms residual. Closed risks are omitted. ${formatReviewCadenceHint(settings)}.`}
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Risk Assessment" },
          ]}
        />

        <ErrorBanner message={error} />

        <form
          onSubmit={(event) => void handleStartReview(event)}
          className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="space-y-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                  Risk checklist
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedCountLabel}
                </p>
              </div>

              <button
                type="submit"
                disabled={!someSelected || submitting || loading}
                className={primaryButtonClassName}
              >
                {submitting ? "Starting..." : "Review Selected"}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Filter
                  </span>
                  <input
                    type="search"
                    value={filterText}
                    onChange={(event) => setFilterText(event.target.value)}
                    placeholder="Filter by title or owner email..."
                    className={listInputClassName}
                  />
                </label>

                {schemaReady && (
                  <FilterSelect
                    label="Category"
                    className="w-full min-w-0 sm:max-w-56"
                    value={categoryId}
                    onChange={setCategoryId}
                    options={categoryFilterOptions(categories)}
                  />
                )}
              </div>

              {risks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectDueForReview}
                    className={secondaryButtonClassName}
                  >
                    Select Due
                  </button>
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className={secondaryButtonClassName}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllVisible}
                    className={secondaryButtonClassName}
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              Loading risks...
            </p>
          ) : risks.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No risks found. Add risks in the risk register before starting a
              risk assessment.
            </p>
          ) : filteredRisks.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No risks match the current filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Inherent</th>
                    {residualReady ? (
                      <th className="px-6 py-3 font-medium">Residual</th>
                    ) : null}
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Last Reviewed</th>
                    <th className="px-6 py-3 font-medium">Cadence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRisks.map((risk) => {
                    const checked = selectedRiskIds.has(risk.id);
                    const due = isReviewDue(
                      risk.lastReviewedAt,
                      risk.likelihood,
                      risk.impact,
                    );
                    const cadenceDays = getReviewCadenceDays(
                      risk.likelihood,
                      risk.impact,
                    );

                    return (
                      <tr
                        key={risk.id}
                        className={`transition-colors hover:bg-teal-50/40 dark:hover:bg-slate-800/60 ${
                          due ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRisk(risk.id)}
                            aria-label={`Select ${risk.title}`}
                            className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600 dark:border-slate-700"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                          {risk.title}
                        </td>
                        <td className="px-6 py-4">
                          <SeverityBandBadge
                            band={getSeverityBand(
                              getRiskScore(risk.likelihood, risk.impact),
                            )}
                          />
                        </td>
                        {residualReady ? (
                          <td className="px-6 py-4">
                            {storedResidual(risk) ? (
                              <SeverityBandBadge band={operatingBand(risk)} />
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">
                                Not assessed
                              </span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {risk.owner_email ?? "—"}
                        </td>
                        <td
                          className={`px-6 py-4 ${
                            due
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {formatLastReviewedAt(risk.lastReviewedAt)}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          Every {cadenceDays} days
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
