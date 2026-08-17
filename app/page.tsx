"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ActivityList } from "@/app/components/dashboard/activity-list";
import { AttentionList } from "@/app/components/dashboard/attention-list";
import { ChartCard } from "@/app/components/dashboard/chart-card";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { StackedTimeChart } from "@/app/components/dashboard/time-charts";
import { FilterSelect } from "@/app/components/list-toolbar";
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import { mutedTextClassName, primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { buildActivityFeed } from "@/lib/activity/feed";
import {
  buildOperatingTrend,
  OPERATING_TREND_SERIES,
} from "@/lib/charts/time-series";
import { buildAttentionItems } from "@/lib/dashboard/attention";
import { summariseIssues } from "@/lib/dashboard/analytics";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import {
  homeCategoryFilterUpdate,
  homeCategorySelectValue,
  isHomeWidgetVisible,
  isModuleHidden,
  resolveHomeCategoryId,
  resolvedDefaultHomeCategoryId,
} from "@/lib/settings/preferences";
import { formatTestingCadenceHint } from "@/lib/settings/store";
import { getSupabaseClient } from "@/lib/supabase/client";
import { buildObligations } from "@/lib/horizon/obligations";
import {
  activeRisks,
  appetiteBreachingRisks,
  openIncidents,
  overdueControls,
} from "@/lib/metrics/kpis";
import {
  emptyGrcSnapshot,
  fetchGrcSnapshot,
  type GrcSnapshot,
} from "@/lib/snapshot/grc-snapshot";
import {
  categoryFilterOptions,
  matchesCategoryFilter,
  matchesInheritedCategory,
} from "@/lib/taxonomy";
import { personByEmail } from "@/lib/types/person";

function parseDashboardFilters(params: URLSearchParams) {
  return { categoryId: params.get("category")?.trim() ?? "" };
}

function HomePageContent() {
  const { settings, categories, schemaReady, people, enterpriseReady } =
    useSettings();
  const { filters, updateFilters } = useListFilters("/", parseDashboardFilters);
  const [snapshot, setSnapshot] = useState<GrcSnapshot>(emptyGrcSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      setSnapshot(await fetchGrcSnapshot(supabase, ownerId, "home"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { user, authLoading } = useRequireAuth(fetchDashboardData);

  const data = useMemo(() => {
    const defaultCategoryId = resolvedDefaultHomeCategoryId(
      settings.workspacePreferences.defaultHomeCategoryId,
      categories,
    );
    const categoryId = resolveHomeCategoryId(
      filters.categoryId,
      defaultCategoryId,
    );
    const risks = snapshot.risks.filter((risk) =>
      matchesCategoryFilter(risk.category_id, categoryId),
    );
    const controls = snapshot.controls.filter((control) =>
      matchesInheritedCategory(
        snapshot.indexes.controlCategoryIds[control.id] ?? [],
        categoryId,
      ),
    );
    const incidents = snapshot.incidents.filter((incident) =>
      matchesInheritedCategory(
        snapshot.indexes.incidentCategoryIds[incident.id] ?? [],
        categoryId,
      ),
    );
    const issues = snapshot.issues.filter((issue) =>
      matchesInheritedCategory(
        snapshot.indexes.issueCategoryIds[issue.id] ?? [],
        categoryId,
      ),
    );
    const lateControls = overdueControls(controls);
    const myPersonId = personByEmail(people, user?.email)?.id ?? null;

    return {
      riskCount: activeRisks(risks).length,
      overdueControlCount: lateControls.length,
      overdueKeyControlCount: lateControls.filter((control) => control.is_key)
        .length,
      openIncidentCount: openIncidents(incidents).length,
      assignedToMe:
        risks.filter((risk) => risk.assignee_id === myPersonId).length +
        controls.filter((control) => control.assignee_id === myPersonId).length +
        incidents.filter((incident) => incident.assignee_id === myPersonId)
          .length +
        issues.filter((issue) => issue.assignee_id === myPersonId).length,
      appetiteBreaches: appetiteBreachingRisks(risks, categories).length,
      issuesSummary: summariseIssues(issues, snapshot.actions),
      attention: buildAttentionItems(controls, incidents, issues, risks, {
        lastReviewedByRisk: snapshot.indexes.lastReviewedByRisk,
        linkedControlCounts: snapshot.indexes.linkedControlCountsByRisk,
        categories,
      }),
      overdueObligations: buildObligations({
        risks,
        controls,
        issues,
        actions: snapshot.actions,
        lastReviewedByRisk: snapshot.indexes.lastReviewedByRisk,
        people,
      }).filter((item) => item.bucket === "overdue").length,
      activity: buildActivityFeed({
        risks,
        controls,
        incidents,
        issues,
        reviews: snapshot.reviews,
        tests: snapshot.tests,
        comments: snapshot.comments,
        riskEvents: snapshot.riskEvents,
        incidentEvents: snapshot.incidentEvents,
        limit: 8,
      }),
      operatingTrend: buildOperatingTrend({
        incidents,
        issues,
        tests: snapshot.tests,
      }),
    };
  }, [categories, filters.categoryId, people, settings.workspacePreferences.defaultHomeCategoryId, snapshot, user?.email]);

  const prefs = settings.workspacePreferences;
  const defaultCategoryId = resolvedDefaultHomeCategoryId(
    prefs.defaultHomeCategoryId,
    categories,
  );
  const categoryId = resolveHomeCategoryId(filters.categoryId, defaultCategoryId);
  const categoryQuery = categoryId
    ? `&category=${encodeURIComponent(categoryId)}`
    : "";
  const shows = (id: Parameters<typeof isHomeWidgetVisible>[1]) =>
    isHomeWidgetVisible(prefs, id);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-10">
        <PageHeader
          title="Dashboard"
          description={
            user?.email
              ? `Welcome back, ${user.email}. Cross-register work sits here; each register has its own Summary tab.`
              : "Cross-register work sits here; each register has its own Summary tab."
          }
          breadcrumbs={[{ label: "Home" }]}
          actions={
            <div className="flex w-full min-w-0 flex-wrap items-end gap-3 sm:w-auto">
              {!isModuleHidden(prefs, "board") ? (
                <Link href="/board" className={secondaryButtonClassName}>
                  Board pack
                </Link>
              ) : null}
              {schemaReady ? (
                <FilterSelect
                  label="Taxonomy lens"
                  className="w-full min-w-0 sm:w-64"
                  value={homeCategorySelectValue(
                    filters.categoryId,
                    defaultCategoryId,
                  )}
                  onChange={(value) =>
                    updateFilters({
                      category: homeCategoryFilterUpdate(value, defaultCategoryId),
                    })
                  }
                  options={categoryFilterOptions(categories)}
                />
              ) : null}
            </div>
          }
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading summary...</p>
        ) : (
          <>
            {shows("stats") ? (
              <section
                className={`grid gap-4 sm:grid-cols-2 ${
                  enterpriseReady ? "lg:grid-cols-3" : "lg:grid-cols-4"
                }`}
              >
                <StatCard
                  label="Open Risks"
                  value={data.riskCount}
                  href={`/risks?status=open${categoryQuery}`}
                  linkLabel="View risk register"
                />
                <StatCard
                  label="Overdue Controls"
                  value={data.overdueControlCount}
                  href={`/controls?testingStatus=Overdue${categoryQuery}`}
                  linkLabel={
                    data.overdueKeyControlCount > 0
                      ? `${data.overdueKeyControlCount} key`
                      : "View overdue controls"
                  }
                  hint={formatTestingCadenceHint(settings)}
                  tone={data.overdueControlCount > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Open Incidents"
                  value={data.openIncidentCount}
                  href={`/incidents?status=open,investigating${categoryQuery}`}
                  linkLabel="View open incidents"
                  hint="Status open or investigating"
                />
                <StatCard
                  label="Open Issues"
                  value={data.issuesSummary.open}
                  href={`/issues?status=open,in_progress,pending_review${categoryQuery}`}
                  linkLabel={
                    data.issuesSummary.overdue > 0
                      ? `${data.issuesSummary.overdue} past target date`
                      : "View open issues"
                  }
                  hint="Findings awaiting remediation"
                  tone={data.issuesSummary.overdue > 0 ? "alert" : "default"}
                />
                {enterpriseReady && (
                  <>
                    <StatCard
                      label="Assigned to me"
                      value={data.assignedToMe}
                      href="/work"
                      linkLabel="Open my work queue"
                      hint="Risks, controls, incidents, and issues"
                    />
                    <StatCard
                      label="Above appetite"
                      value={data.appetiteBreaches}
                      href={`/risks?appetiteBreach=true${categoryQuery}`}
                      linkLabel="View appetite breaches"
                      tone={data.appetiteBreaches > 0 ? "alert" : "default"}
                    />
                  </>
                )}
                <StatCard
                  label="Due now"
                  value={data.overdueObligations}
                  href="/horizon?bucket=overdue"
                  linkLabel="Open operating horizon"
                  hint="Reviews, tests, findings, and actions"
                  tone={data.overdueObligations > 0 ? "alert" : "default"}
                />
              </section>
            ) : null}

            {shows("attention") || shows("activity") ? (
              <section className="grid min-w-0 gap-6 lg:grid-cols-2">
                {shows("attention") ? (
                  <ChartCard
                    title="Needs attention"
                    description="Overdue issues, failed or overdue key controls, open high/critical incidents, appetite breaches, and High/Critical risks that are uncontrolled or past their review cadence."
                  >
                    {data.riskCount === 0 &&
                    data.overdueControlCount === 0 &&
                    data.openIncidentCount === 0 &&
                    data.issuesSummary.total === 0 ? (
                      <div className="space-y-3">
                        <p className={`text-sm ${mutedTextClassName}`}>
                          Nothing in the registers yet. Start with a risk, or load
                          demonstration data from Admin to walk the product.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Link href="/risks/new" className={primaryButtonClassName}>
                            Add your first risk
                          </Link>
                          <Link href="/admin" className={secondaryButtonClassName}>
                            Open Admin
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <AttentionList items={data.attention} />
                    )}
                  </ChartCard>
                ) : null}

                {shows("activity") ? (
                  <ChartCard
                    title="Recent activity"
                    description="Latest reviews, tests, incidents, and issue trail entries."
                  >
                    <ActivityList items={data.activity} />
                  </ChartCard>
                ) : null}
              </section>
            ) : null}

            {shows("trend") ? (
              <ChartCard
                title="Operating trend"
                description="Incidents occurred, issues identified, and control tests recorded over the last 12 months. Register-specific charts live on each register’s Summary tab."
              >
                <StackedTimeChart
                  data={data.operatingTrend}
                  series={[...OPERATING_TREND_SERIES]}
                  empty="No incidents, issues, or tests in the last 12 months."
                />
              </ChartCard>
            ) : null}

            {!shows("stats") &&
            !shows("attention") &&
            !shows("activity") &&
            !shows("trend") ? (
              <p className={mutedTextClassName}>
                Home widgets are hidden. Restore them from Admin → Workspace.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomePageContent />
    </Suspense>
  );
}
