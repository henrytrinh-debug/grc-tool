"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
} from "@/app/components/page-parts";
import { SeverityBandBadge } from "@/app/components/status-badge";
import { primaryButtonClassName } from "@/app/components/ui";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
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
  groupIssuesByRisk,
  ISSUE_RISK_ISSUE_SELECT,
  type IssueRiskIssueRow,
} from "@/lib/types/issue-links";
import { countGroupedLinks } from "@/lib/types/join-utils";
import type { Risk } from "@/lib/types/risk";
import {
  groupRiskControlRows,
  type RiskControlRow,
} from "@/lib/types/risk-control";

function RisksPageContent() {
  const router = useRouter();
  const { filters, updateFilters, clearFilters } = useListFilters(
    "/risks",
    parseRiskFilters,
  );

  const [risks, setRisks] = useState<Risk[]>([]);
  const [linkedControlCounts, setLinkedControlCounts] = useState<
    Record<string, number>
  >({});
  const [linkedIncidentCounts, setLinkedIncidentCounts] = useState<
    Record<string, number>
  >({});
  const [openIssueCounts, setOpenIssueCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRisks = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [
        risksResult,
        controlLinksResult,
        incidentLinksResult,
        issueLinksResult,
      ] = await Promise.all([
        supabase
          .from("risks")
          .select("*")
          .eq("owner_id", ownerId)
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
        supabase
          .from("issue_risks")
          .select(ISSUE_RISK_ISSUE_SELECT)
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

      if (issueLinksResult.error) {
        throw issueLinksResult.error;
      }

      setRisks((risksResult.data ?? []) as Risk[]);

      setLinkedControlCounts(
        countGroupedLinks(
          groupRiskControlRows(
            (controlLinksResult.data ?? []) as RiskControlRow[],
          ),
        ),
      );

      setLinkedIncidentCounts(
        countGroupedLinks(
          groupIncidentRiskRowsByRisk(
            (incidentLinksResult.data ?? []) as IncidentRiskIncidentRow[],
          ),
        ),
      );

      const issuesByRisk = groupIssuesByRisk(
        (issueLinksResult.data ?? []) as IssueRiskIssueRow[],
      );
      const openCounts: Record<string, number> = {};
      for (const [riskId, issues] of Object.entries(issuesByRisk)) {
        openCounts[riskId] = issues.filter(
          (issue) => issue.status !== "closed",
        ).length;
      }
      setOpenIssueCounts(openCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risks");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(loadRisks);

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
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <PageHeader
          title="Risk Register"
          description="Track and assess organizational risks."
          actions={
            <Link href="/risks/new" className={primaryButtonClassName}>
              Add Risk
            </Link>
          }
        />

        <ErrorBanner message={error} />

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
                    <th className="px-6 py-3 font-medium">Likelihood</th>
                    <th className="px-6 py-3 font-medium">Impact</th>
                    <th className="px-6 py-3 font-medium">Risk Score</th>
                    <th className="px-6 py-3 font-medium">Controls</th>
                    <th className="px-6 py-3 font-medium">Incidents</th>
                    <th className="px-6 py-3 font-medium">Open Issues</th>
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRisks.map((risk) => {
                    const band = getSeverityBand(
                      getRiskScore(risk.likelihood, risk.impact),
                    );
                    const openIssues = openIssueCounts[risk.id] ?? 0;

                    return (
                      <tr
                        key={risk.id}
                        onClick={() => router.push(`/risks/${risk.id}/edit`)}
                        className="cursor-pointer transition-colors hover:bg-teal-50/60 dark:hover:bg-slate-800/80"
                      >
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                          {risk.title}
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
                        <td className="px-6 py-4">
                          <span
                            className={
                              openIssues > 0
                                ? "font-medium text-red-700 dark:text-red-400"
                                : "text-slate-950 dark:text-slate-50"
                            }
                          >
                            {openIssues}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
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
                            Review
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
    <Suspense fallback={<PageLoading />}>
      <RisksPageContent />
    </Suspense>
  );
}
