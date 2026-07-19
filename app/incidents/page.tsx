"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
} from "@/app/components/status-badge";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  filterIncidents,
  hasActiveFilters,
  parseIncidentFilters,
} from "@/lib/list-filters";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  type Incident,
} from "@/lib/types/incident";
import {
  groupIncidentRiskRowsByIncident,
  type IncidentRiskRow,
} from "@/lib/types/incident-risk";

function IncidentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseIncidentFilters(searchParams),
    [searchParams],
  );

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [linkedRiskCounts, setLinkedRiskCounts] = useState<
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
      router.replace(query ? `/incidents?${query}` : "/incidents");
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.replace("/incidents");
  }, [router]);

  const fetchIncidents = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [incidentsResult, linksResult] = await Promise.all([
        supabase
          .from("incidents")
          .select("*")
          .eq("owner_id", ownerId)
          .order("date_occurred", { ascending: false }),
        supabase
          .from("incident_risks")
          .select(
            "id, incident_id, risk_id, risks(title, likelihood, impact, owner_email)",
          )
          .eq("owner_id", ownerId),
      ]);

      if (incidentsResult.error) {
        throw incidentsResult.error;
      }

      if (linksResult.error) {
        throw linksResult.error;
      }

      setIncidents(incidentsResult.data ?? []);

      const grouped = groupIncidentRiskRowsByIncident(
        (linksResult.data ?? []) as IncidentRiskRow[],
      );
      const counts: Record<string, number> = {};
      for (const [incidentId, links] of Object.entries(grouped)) {
        counts[incidentId] = links.length;
      }
      setLinkedRiskCounts(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
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

      setAuthLoading(false);
      await fetchIncidents(session.user.id);
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
  }, [fetchIncidents, router]);

  const filteredIncidents = useMemo(
    () => filterIncidents(incidents, filters),
    [incidents, filters],
  );

  const statusFilterValue =
    filters.status.length === 2 &&
    filters.status.includes("open") &&
    filters.status.includes("investigating")
      ? "open,investigating"
      : filters.status.length === 1
        ? filters.status[0]
        : "";

  const filtersActive = hasActiveFilters({
    q: filters.q,
    severity: filters.severity,
    status: filters.status,
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
              Incident Register
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Track and manage security and compliance incidents.
            </p>
          </div>
          <Link
            href="/incidents/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Add Incident
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
            searchPlaceholder="Search title, description, or root cause..."
            showing={filteredIncidents.length}
            total={incidents.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
          >
            <FilterSelect
              label="Severity"
              value={filters.severity}
              onChange={(value) => updateFilters({ severity: value })}
              options={SEVERITY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <FilterSelect
              label="Status"
              value={statusFilterValue}
              onChange={(value) => updateFilters({ status: value })}
              options={[
                ...STATUS_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
                {
                  value: "open,investigating",
                  label: "Open or Investigating",
                },
              ]}
            />
          </ListToolbar>

          {loading ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              Loading incidents...
            </p>
          ) : incidents.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No incidents yet.{" "}
              <Link
                href="/incidents/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first incident
              </Link>
              .
            </p>
          ) : filteredIncidents.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No incidents match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Date Occurred</th>
                    <th className="px-6 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Linked Risks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredIncidents.map((incident) => (
                    <tr
                      key={incident.id}
                      onClick={() =>
                        router.push(`/incidents/${incident.id}/edit`)
                      }
                      className="cursor-pointer transition-colors hover:bg-teal-50/60 dark:hover:bg-slate-800/80"
                    >
                      <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                        {incident.title}
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {formatDateOccurred(incident.date_occurred)}
                      </td>
                      <td className="px-6 py-4">
                        <IncidentSeverityBadge
                          severity={incident.severity}
                          label={formatSeverity(incident.severity)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <IncidentStatusBadge
                          status={incident.status}
                          label={formatIncidentStatus(incident.status)}
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {linkedRiskCounts[incident.id] ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      }
    >
      <IncidentsPageContent />
    </Suspense>
  );
}
