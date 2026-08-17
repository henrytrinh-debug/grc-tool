"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClickableRow } from "@/app/components/clickable-row";
import { QualityTitle } from "@/app/components/quality-indicator";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import { RegisterPresets } from "@/app/components/register-presets";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageHeader,
  PageLoading,
  RegisterTable,
  registerTheadClassName,
} from "@/app/components/page-parts";
import {
  AppetiteBreachBadge,
  RiskStatusBadge,
  SeverityBandBadge,
} from "@/app/components/status-badge";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { riskQuality } from "@/lib/data-quality/record";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterRisks,
  hasActiveFilters,
  parseRiskFilters,
  sortRisksByExposure,
} from "@/lib/list-filters";
import { categoryFilterOptions, assigneeFilterOptions, isAppetiteBreach } from "@/lib/taxonomy";
import { formatIsoDate } from "@/lib/dates";
import { downloadCsv } from "@/lib/export/csv";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import {
  departmentFilterOptions,
  formatPersonDepartment,
  formatPersonName,
  personByEmail,
} from "@/lib/types/person";
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
  formatNextReviewDue,
  isReviewDue,
  type RcsaReview,
} from "@/lib/types/rcsa";
import {
  formatImpactOption,
  formatLikelihoodOption,
  formatRiskStatus,
  formatTreatment,
  RISK_SCALE_VALUES,
  RISK_STATUS_OPTIONS,
  RISK_TREATMENT_OPTIONS,
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

  const { categories, schemaReady, people, enterpriseReady, operatingReady } = useSettings();
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

  const { user, authLoading } = useRequireAuth(loadRisks);

  const myPersonId = personByEmail(people, user?.email)?.id ?? null;

  const filteredRisks = useMemo(
    () =>
      sortRisksByExposure(
        filterRisks(risks, filters, {
          lastReviewedByRisk,
          linkedControlCounts,
          categories,
          myPersonId,
          people,
        }),
      ),
    [risks, filters, lastReviewedByRisk, linkedControlCounts, categories, myPersonId, people],
  );

  const categoryNameById = useMemo(() => {
    const names: Record<string, string> = {};
    for (const category of categories) {
      names[category.id] = category.name;
    }
    return names;
  }, [categories]);

  const filtersActive = hasActiveFilters({
    q: filters.q,
    severity: filters.severity,
    likelihood: filters.likelihood,
    impact: filters.impact,
    reviewRecency: filters.reviewRecency,
    uncontrolled: filters.uncontrolled,
    categoryId: filters.categoryId,
    treatment: filters.treatment,
    status: filters.status,
    assignee: filters.assignee,
    appetiteBreach: filters.appetiteBreach,
    department: filters.department,
  });

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8">
        <PageHeader
          title="Risk Register"
          description="Track and assess organizational risks."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Risks" },
          ]}
          actions={
            <Link href="/risks/new" className={primaryButtonClassName}>
              Add Risk
            </Link>
          }
        />

        <ErrorBanner message={error} />

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title or description..."
            showing={filteredRisks.length}
            total={risks.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              <>
                <RegisterPresets module="risks" />
                {filteredRisks.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "risk-register",
                      [
                        "Title",
                        "Category",
                        "Treatment",
                        "Status",
                        "Assignee",
                        "Department",
                        "Likelihood",
                        "Impact",
                        "Score",
                        "Band",
                        "Appetite breach",
                        "Controls",
                        "Incidents",
                        "Open Issues",
                        "Last Reviewed",
                        "Next Review",
                        "Target date",
                        "Owner",
                      ],
                      filteredRisks.map((risk) => {
                        const score = getRiskScore(
                          risk.likelihood,
                          risk.impact,
                        );
                        return [
                          risk.title,
                          (risk.category_id &&
                            categoryNameById[risk.category_id]) ||
                            "Uncategorised",
                          formatTreatment(risk.treatment),
                          formatRiskStatus(risk.status),
                          formatPersonName(people, risk.assignee_id),
                          formatPersonDepartment(people, risk.assignee_id),
                          risk.likelihood,
                          risk.impact,
                          score,
                          getSeverityBand(score),
                          isAppetiteBreach(risk, categories) ? "Yes" : "No",
                          linkedControlCounts[risk.id] ?? 0,
                          linkedIncidentCounts[risk.id] ?? 0,
                          openIssueCounts[risk.id] ?? 0,
                          formatLastReviewedAt(
                            lastReviewedByRisk[risk.id] ?? null,
                          ),
                          formatNextReviewDue(
                            lastReviewedByRisk[risk.id] ?? null,
                            risk.likelihood,
                            risk.impact,
                          ),
                          formatIsoDate(risk.target_date),
                          risk.owner_email ?? "",
                        ];
                      }),
                    )
                  }
                >
                  Export CSV
                </button>
                ) : null}
              </>
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
                { value: "High,Critical", label: "High or Critical" },
              ]}
            />
            {schemaReady && (
              <FilterSelect
                label="Category"
                value={filters.categoryId}
                onChange={(value) => updateFilters({ category: value })}
                options={categoryFilterOptions(categories)}
              />
            )}
            {schemaReady && (
              <FilterSelect
                label="Treatment"
                value={filters.treatment}
                onChange={(value) => updateFilters({ treatment: value })}
                options={RISK_TREATMENT_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            )}
            {enterpriseReady && (
              <>
                <FilterSelect
                  label="Status"
                  value={filters.status}
                  onChange={(value) => updateFilters({ status: value })}
                  options={RISK_STATUS_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
                <FilterSelect
                  label="Owner"
                  value={filters.assignee}
                  onChange={(value) => updateFilters({ assignee: value })}
                  options={assigneeFilterOptions(people)}
                />
                {departmentFilterOptions(people).length > 0 && (
                  <FilterSelect
                    label="Department"
                    value={filters.department}
                    onChange={(value) => updateFilters({ department: value })}
                    options={departmentFilterOptions(people)}
                  />
                )}
                <FilterSelect
                  label="Appetite"
                  value={filters.appetiteBreach ? "true" : ""}
                  onChange={(value) => updateFilters({ appetiteBreach: value })}
                  options={[{ value: "true", label: "Above appetite" }]}
                />
              </>
            )}
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
            <LoadingBlock label="Loading risks..." />
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
            <RegisterTable>
                <thead className={registerTheadClassName}>
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    {schemaReady && (
                      <>
                        <th className="px-6 py-3 font-medium">Category</th>
                        <th className="px-6 py-3 font-medium">Treatment</th>
                      </>
                    )}
                    {enterpriseReady && (
                      <>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Assignee</th>
                      </>
                    )}
                    <th className="px-6 py-3 font-medium">Likelihood</th>
                    <th className="px-6 py-3 font-medium">Impact</th>
                    <th className="px-6 py-3 font-medium">Risk Score</th>
                    <th className="px-6 py-3 font-medium">Controls</th>
                    <th className="px-6 py-3 font-medium">Incidents</th>
                    <th className="px-6 py-3 font-medium">Open Issues</th>
                    <th className="px-6 py-3 font-medium">Review</th>
                    {operatingReady && (
                      <th className="px-6 py-3 font-medium">Target</th>
                    )}
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
                    const appetiteBreach = isAppetiteBreach(risk, categories);
                    const needsAttention =
                      (risk.status !== "closed" &&
                        (reviewDue || controlCount === 0)) ||
                      appetiteBreach;

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
                          <div className="flex flex-col gap-1">
                            <QualityTitle
                              summary={riskQuality(risk, {
                                controlCount,
                                hasReview: Boolean(lastReviewedAt),
                                operatingReady,
                                enterpriseReady,
                              })}
                            >
                              {risk.title}
                            </QualityTitle>
                            {appetiteBreach && <AppetiteBreachBadge />}
                          </div>
                        </td>
                        {schemaReady && (
                          <>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {(risk.category_id &&
                                categoryNameById[risk.category_id]) ||
                                "Uncategorised"}
                            </td>
                            <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                              {formatTreatment(risk.treatment)}
                            </td>
                          </>
                        )}
                        {enterpriseReady && (
                          <>
                            <td className="px-6 py-4">
                              <RiskStatusBadge
                                status={risk.status ?? "open"}
                                label={formatRiskStatus(risk.status)}
                              />
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {formatPersonName(people, risk.assignee_id)}
                            </td>
                          </>
                        )}
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
                              controlCount === 0 && risk.status !== "closed"
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
                            reviewDue && risk.status !== "closed"
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <div>{formatLastReviewedAt(lastReviewedAt)}</div>
                          <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            Next{" "}
                            {risk.status === "closed"
                              ? "—"
                              : formatNextReviewDue(
                                  lastReviewedAt,
                                  risk.likelihood,
                                  risk.impact,
                                )}
                          </div>
                        </td>
                        {operatingReady && (
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {risk.status === "closed"
                              ? "—"
                              : formatIsoDate(risk.target_date)}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          {risk.status === "closed" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
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
                          )}
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
            </RegisterTable>
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
