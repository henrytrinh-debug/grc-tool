"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClickableRow } from "@/app/components/clickable-row";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  ErrorBanner,
  ListEmpty,
  PageHeader,
  PageLoading,
} from "@/app/components/page-parts";
import { SeverityBandBadge } from "@/app/components/status-badge";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterRisks,
  hasActiveFilters,
  parseRiskFilters,
  sortRisksByExposure,
} from "@/lib/list-filters";
import { downloadCsv } from "@/lib/export/csv";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
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
import {
  buildLastReviewedByRisk,
  formatLastReviewedAt,
  isReviewDue,
  type RcsaReview,
} from "@/lib/types/rcsa";
import {
  formatImpactOption,
  formatLikelihoodOption,
  RISK_SCALE_VALUES,
  type Risk,
} from "@/lib/types/risk";
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
  const [lastReviewedByRisk, setLastReviewedByRisk] = useState<
    Record<string, string>
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
        reviewsResult,
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
        supabase
          .from("rcsa_reviews")
          .select("risk_id, reviewed_at")
          .eq("owner_id", ownerId),
      ]);

      throwIfAnyQueryError([
        risksResult,
        controlLinksResult,
        incidentLinksResult,
        issueLinksResult,
        reviewsResult,
      ]);

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
      setLastReviewedByRisk(
        buildLastReviewedByRisk(
          (reviewsResult.data ?? []) as Pick<
            RcsaReview,
            "risk_id" | "reviewed_at"
          >[],
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risks");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(loadRisks);

  const filteredRisks = useMemo(
    () =>
      sortRisksByExposure(
        filterRisks(risks, filters, {
          lastReviewedByRisk,
          linkedControlCounts,
        }),
      ),
    [risks, filters, lastReviewedByRisk, linkedControlCounts],
  );

  const filtersActive = hasActiveFilters({
    q: filters.q,
    severity: filters.severity,
    likelihood: filters.likelihood,
    impact: filters.impact,
    reviewRecency: filters.reviewRecency,
    uncontrolled: filters.uncontrolled,
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
            actions={
              filteredRisks.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "risk-register",
                      [
                        "Title",
                        "Likelihood",
                        "Impact",
                        "Score",
                        "Band",
                        "Controls",
                        "Incidents",
                        "Open Issues",
                        "Last Reviewed",
                        "Owner",
                      ],
                      filteredRisks.map((risk) => {
                        const score = getRiskScore(
                          risk.likelihood,
                          risk.impact,
                        );
                        return [
                          risk.title,
                          risk.likelihood,
                          risk.impact,
                          score,
                          getSeverityBand(score),
                          linkedControlCounts[risk.id] ?? 0,
                          linkedIncidentCounts[risk.id] ?? 0,
                          openIssueCounts[risk.id] ?? 0,
                          formatLastReviewedAt(
                            lastReviewedByRisk[risk.id] ?? null,
                          ),
                          risk.owner_email ?? "",
                        ];
                      }),
                    )
                  }
                >
                  Export CSV
                </button>
              ) : null
            }
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
              options={RISK_SCALE_VALUES.map((value) => ({
                value: String(value),
                label: formatLikelihoodOption(value),
              }))}
            />
            <FilterSelect
              label="Impact"
              value={filters.impact?.toString() ?? ""}
              onChange={(value) => updateFilters({ impact: value })}
              options={RISK_SCALE_VALUES.map((value) => ({
                value: String(value),
                label: formatImpactOption(value),
              }))}
            />
            <FilterSelect
              label="Review"
              value={filters.reviewRecency}
              onChange={(value) => updateFilters({ reviewRecency: value })}
              options={[
                { value: "due", label: "Due for review" },
                { value: "never", label: "Never reviewed" },
                { value: "over365", label: "Reviewed > 365 days ago" },
              ]}
            />
            <FilterSelect
              label="Controls"
              value={filters.uncontrolled ? "true" : ""}
              onChange={(value) => updateFilters({ uncontrolled: value })}
              options={[{ value: "true", label: "Uncontrolled only" }]}
            />
          </ListToolbar>

          {loading ? (
            <ListEmpty>Loading risks...</ListEmpty>
          ) : risks.length === 0 ? (
            <ListEmpty>
              No risks yet.{" "}
              <Link
                href="/risks/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first risk
              </Link>
              .
            </ListEmpty>
          ) : filteredRisks.length === 0 ? (
            <ListEmpty>No risks match the current filters.</ListEmpty>
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
                    <th className="px-6 py-3 font-medium">Last Reviewed</th>
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

                    const lastReviewedAt = lastReviewedByRisk[risk.id] ?? null;
                    const controlCount = linkedControlCounts[risk.id] ?? 0;
                    const reviewDue = isReviewDue(
                      lastReviewedAt,
                      risk.likelihood,
                      risk.impact,
                    );
                    const needsAttention = reviewDue || controlCount === 0;

                    return (
                      <ClickableRow
                        key={risk.id}
                        href={`/risks/${risk.id}/edit`}
                        label={`Open ${risk.title}`}
                        className={
                          needsAttention
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : undefined
                        }
                      >
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                          {risk.title}
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {formatLikelihoodOption(risk.likelihood)}
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {formatImpactOption(risk.impact)}
                        </td>
                        <td className="px-6 py-4">
                          <SeverityBandBadge band={band} />
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={
                              controlCount === 0
                                ? "font-medium text-red-700 dark:text-red-400"
                                : "text-slate-950 dark:text-slate-50"
                            }
                          >
                            {controlCount}
                          </span>
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
                        <td
                          className={`px-6 py-4 ${
                            reviewDue
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {formatLastReviewedAt(lastReviewedAt)}
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
                      </ClickableRow>
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
