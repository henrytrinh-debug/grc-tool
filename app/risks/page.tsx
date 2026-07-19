"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SeverityBandBadge } from "@/app/components/status-badge";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  getRiskScore,
  getSeverityBand,
} from "@/lib/dashboard/analytics";
import {
  filterRisks,
  hasActiveFilters,
  parseRiskFilters,
} from "@/lib/list-filters";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  groupIncidentRiskRowsByRisk,
  type IncidentRiskIncidentRow,
} from "@/lib/types/incident-risk";
import {
  groupRiskControlRows,
  type RiskControlRow,
} from "@/lib/types/risk-control";
import type { Risk } from "@/lib/types/risk";

function RisksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseRiskFilters(searchParams),
    [searchParams],
  );

  const [risks, setRisks] = useState<Risk[]>([]);
  const [linkedControlCounts, setLinkedControlCounts] = useState<
    Record<string, number>
  >({});
  const [linkedIncidentCounts, setLinkedIncidentCounts] = useState<
    Record<string, number>
  >({});
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();
      router.replace(query ? `/risks?${query}` : "/risks");
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.replace("/risks");
  }, [router]);

  const fetchRisks = useCallback(async () => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const ownerId = session.user.id;

      const [risksResult, controlLinksResult, incidentLinksResult] =
        await Promise.all([
          supabase
            .from("risks")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("risk_controls")
            .select(
              "id, risk_id, control_id, controls(title, effectiveness, last_tested_at, is_key)",
            )
            .eq("owner_id", ownerId),
          supabase
            .from("incident_risks")
            .select(
              "id, incident_id, risk_id, incidents(title, date_occurred, severity, status)",
            )
            .eq("owner_id", ownerId),
        ]);

      if (risksResult.error) {
        throw risksResult.error;
      }

      if (controlLinksResult.error) {
        throw controlLinksResult.error;
      }

      if (incidentLinksResult.error) {
        throw incidentLinksResult.error;
      }

      setRisks(risksResult.data ?? []);

      const controlGrouped = groupRiskControlRows(
        (controlLinksResult.data ?? []) as RiskControlRow[],
      );
      const controlCounts: Record<string, number> = {};
      for (const [riskId, links] of Object.entries(controlGrouped)) {
        controlCounts[riskId] = links.length;
      }
      setLinkedControlCounts(controlCounts);

      const incidentGrouped = groupIncidentRiskRowsByRisk(
        (incidentLinksResult.data ?? []) as IncidentRiskIncidentRow[],
      );
      const incidentCounts: Record<string, number> = {};
      for (const [riskId, links] of Object.entries(incidentGrouped)) {
        incidentCounts[riskId] = links.length;
      }
      setLinkedIncidentCounts(incidentCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risks");
    } finally {
      setLoading(false);
    }
  }, [router]);

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

      setAuthLoading(false);
      await fetchRisks();
    }

    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchRisks, router]);

  const filteredRisks = useMemo(
    () => filterRisks(risks, filters),
    [risks, filters],
  );

  const filtersActive = hasActiveFilters({
    q: filters.q,
    severity: filters.severity,
    likelihood: filters.likelihood,
    impact: filters.impact,
  });

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Risk Register
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Track and assess organizational risks.
            </p>
          </div>
          <Link
            href="/risks/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Add Risk
          </Link>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title or description..."
            showing={filteredRisks.length}
            total={risks.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
          >
            <FilterSelect
              label="Risk Score"
              value={filters.severity}
              onChange={(value) => updateFilters({ severity: value })}
              options={[
                { value: "Low", label: "Low" },
                { value: "Medium", label: "Medium" },
                { value: "High", label: "High" },
                { value: "Critical", label: "Critical" },
              ]}
            />
            <FilterSelect
              label="Likelihood"
              value={filters.likelihood?.toString() ?? ""}
              onChange={(value) => updateFilters({ likelihood: value })}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
            <FilterSelect
              label="Impact"
              value={filters.impact?.toString() ?? ""}
              onChange={(value) => updateFilters({ impact: value })}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
          </ListToolbar>

          {loading ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              Loading risks...
            </p>
          ) : risks.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No risks yet.{" "}
              <Link
                href="/risks/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first risk
              </Link>
              .
            </p>
          ) : filteredRisks.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No risks match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Description</th>
                    <th className="px-6 py-3 font-medium">Likelihood</th>
                    <th className="px-6 py-3 font-medium">Impact</th>
                    <th className="px-6 py-3 font-medium">Risk Score</th>
                    <th className="px-6 py-3 font-medium">Linked Controls</th>
                    <th className="px-6 py-3 font-medium">Linked Incidents</th>
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRisks.map((risk) => {
                    const band = getSeverityBand(
                      getRiskScore(risk.likelihood, risk.impact),
                    );

                    return (
                      <tr
                        key={risk.id}
                        onClick={() => router.push(`/risks/${risk.id}/edit`)}
                        className="cursor-pointer transition-colors hover:bg-teal-50/60 dark:hover:bg-slate-800/80"
                      >
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                          {risk.title}
                        </td>
                        <td className="max-w-xs truncate px-6 py-4 text-slate-600 dark:text-slate-400">
                          {risk.description}
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {risk.likelihood}
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {risk.impact}
                        </td>
                        <td className="px-6 py-4">
                          <SeverityBandBadge band={band} />
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {linkedControlCounts[risk.id] ?? 0}
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {linkedIncidentCounts[risk.id] ?? 0}
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {risk.owner_email}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/rcsa/review?risk=${risk.id}`);
                            }}
                            className="rounded-lg border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-50 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-950"
                          >
                            Review This Risk
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function RisksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      }
    >
      <RisksPageContent />
    </Suspense>
  );
}
