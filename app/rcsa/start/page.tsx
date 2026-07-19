"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  buildLastReviewedByRisk,
  formatLastReviewedAt,
  type RcsaReview,
  type RiskWithLastReviewed,
} from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

const filterInputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

export default function RcsaStartPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [risks, setRisks] = useState<RiskWithLastReviewed[]>([]);
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(
    new Set(),
  );
  const [filterText, setFilterText] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
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
          .select("id, title, likelihood, impact, owner_email")
          .eq("owner_id", ownerId)
          .order("title", { ascending: true }),
        supabase
          .from("rcsa_reviews")
          .select("risk_id, reviewed_at")
          .eq("owner_id", ownerId),
      ]);

      if (risksResult.error) {
        throw risksResult.error;
      }

      if (reviewsResult.error) {
        throw reviewsResult.error;
      }

      const lastReviewedByRisk = buildLastReviewedByRisk(
        (reviewsResult.data ?? []) as Pick<
          RcsaReview,
          "risk_id" | "reviewed_at"
        >[],
      );

      const checklist = ((risksResult.data ?? []) as Risk[]).map((risk) => ({
        id: risk.id,
        title: risk.title,
        likelihood: risk.likelihood,
        impact: risk.impact,
        owner_email: risk.owner_email,
        lastReviewedAt: lastReviewedByRisk[risk.id] ?? null,
      }));

      setRisks(checklist);
      setSelectedRiskIds(new Set(checklist.map((risk) => risk.id)));
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

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      setAuthLoading(false);
      await fetchChecklist(session.user.id);
    }

    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchChecklist, router]);

  const filteredRisks = useMemo(() => {
    const query = filterText.trim().toLowerCase();

    if (!query) {
      return risks;
    }

    return risks.filter((risk) => {
      const title = risk.title.toLowerCase();
      const owner = (risk.owner_email ?? "").toLowerCase();
      return title.includes(query) || owner.includes(query);
    });
  }, [filterText, risks]);

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
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Risk Assessment
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Select the risks you want to include in this review cycle.
          </p>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form
          onSubmit={(event) => void handleStartReview(event)}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
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
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
              >
                {submitting ? "Starting..." : "Review Selected"}
              </button>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Filter
                </span>
                <input
                  type="search"
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder="Filter by title or owner email..."
                  className={filterInputClassName}
                />
              </label>

              {risks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllVisible}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Last Reviewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRisks.map((risk) => {
                    const checked = selectedRiskIds.has(risk.id);

                    return (
                      <tr
                        key={risk.id}
                        className="transition-colors hover:bg-teal-50/40 dark:hover:bg-slate-800/60"
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
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {risk.owner_email ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {formatLastReviewedAt(risk.lastReviewedAt)}
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
