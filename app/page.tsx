"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AttentionList } from "@/app/components/dashboard/attention-list";
import { ChartCard } from "@/app/components/dashboard/chart-card";
import {
  ControlsEffectivenessDonut,
  IncidentsStatusDonut,
  IssuesStatusDonut,
} from "@/app/components/dashboard/donut-charts";
import { RemediationHealth } from "@/app/components/dashboard/remediation-health";
import { RiskHeatMap } from "@/app/components/dashboard/risk-heat-map";
import { RiskSeverityBarChart } from "@/app/components/dashboard/risk-severity-bar-chart";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { TaxonomyBarChart } from "@/app/components/dashboard/taxonomy-bar-chart";
import { FilterSelect } from "@/app/components/list-toolbar";
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import { mutedTextClassName, primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { buildAttentionItems } from "@/lib/dashboard/attention";
import {
  buildControlEffectivenessCounts,
  buildIncidentStatusCounts,
  buildIssueStatusCounts,
  buildOpenIssueSeverityBreakdown,
  buildSeverityBandCounts,
  buildTaxonomyRiskCounts,
  buildTreatmentCounts,
  summariseIssues,
} from "@/lib/dashboard/analytics";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { formatTestingCadenceHint } from "@/lib/settings/store";
import { fetchOwnedTable } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  categoryFilterOptions,
  indexLinkedCategories,
  isActiveRisk,
  isAppetiteBreach,
  matchesCategoryFilter,
  matchesInheritedCategory,
} from "@/lib/taxonomy";
import { getTestingStatus, type Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";
import { countByKey } from "@/lib/types/join-utils";
import { personByEmail } from "@/lib/types/person";
import { buildLastReviewedByRisk, type RcsaReview } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

type Snapshot = {
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
  actions: IssueAction[];
  linkedControlCounts: Record<string, number>;
  controlCategoryIds: Record<string, string[]>;
  issueCategoryIds: Record<string, string[]>;
  incidentCategoryIds: Record<string, string[]>;
  lastReviewedByRisk: Record<string, string>;
};

const emptySnapshot: Snapshot = {
  risks: [],
  controls: [],
  incidents: [],
  issues: [],
  actions: [],
  linkedControlCounts: {},
  controlCategoryIds: {},
  issueCategoryIds: {},
  incidentCategoryIds: {},
  lastReviewedByRisk: {},
};

function parseDashboardFilters(params: URLSearchParams) {
  return { categoryId: params.get("category")?.trim() ?? "" };
}

function HomePageContent() {
  const { settings, categories, schemaReady, people, enterpriseReady } =
    useSettings();
  const { filters, updateFilters } = useListFilters("/", parseDashboardFilters);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [
        risks,
        controls,
        incidents,
        issues,
        actions,
        controlLinks,
        issueLinks,
        incidentLinks,
        reviews,
      ] = await Promise.all([
        fetchOwnedTable<Risk>(supabase, "risks", ownerId),
        fetchOwnedTable<Control>(supabase, "controls", ownerId),
        fetchOwnedTable<Incident>(supabase, "incidents", ownerId),
        fetchOwnedTable<Issue>(supabase, "issues", ownerId),
        fetchOwnedTable<IssueAction>(supabase, "issue_actions", ownerId),
        supabase
          .from("risk_controls")
          .select("id, risk_id, control_id")
          .eq("owner_id", ownerId),
        supabase
          .from("issue_risks")
          .select("issue_id, risk_id")
          .eq("owner_id", ownerId),
        supabase
          .from("incident_risks")
          .select("incident_id, risk_id")
          .eq("owner_id", ownerId),
        supabase
          .from("rcsa_reviews")
          .select("risk_id, reviewed_at")
          .eq("owner_id", ownerId),
      ]);

      if (controlLinks.error) {
        throw controlLinks.error;
      }

      if (issueLinks.error) {
        throw issueLinks.error;
      }

      if (incidentLinks.error) {
        throw incidentLinks.error;
      }

      if (reviews.error) {
        throw reviews.error;
      }

      const riskById = Object.fromEntries(risks.map((risk) => [risk.id, risk]));

      setSnapshot({
        risks,
        controls,
        incidents,
        issues,
        actions,
        linkedControlCounts: countByKey(
          (controlLinks.data ?? []) as { risk_id: string }[],
          (link) => link.risk_id,
        ),
        controlCategoryIds: indexLinkedCategories(
          (
            (controlLinks.data ?? []) as {
              control_id: string;
              risk_id: string;
            }[]
          ).map((link) => ({
            parentId: link.control_id,
            categoryId: riskById[link.risk_id]?.category_id,
          })),
        ),
        issueCategoryIds: indexLinkedCategories(
          ((issueLinks.data ?? []) as { issue_id: string; risk_id: string }[]).map(
            (link) => ({
              parentId: link.issue_id,
              categoryId: riskById[link.risk_id]?.category_id,
            }),
          ),
        ),
        incidentCategoryIds: indexLinkedCategories(
          (
            (incidentLinks.data ?? []) as {
              incident_id: string;
              risk_id: string;
            }[]
          ).map((link) => ({
            parentId: link.incident_id,
            categoryId: riskById[link.risk_id]?.category_id,
          })),
        ),
        lastReviewedByRisk: buildLastReviewedByRisk(
          (reviews.data ?? []) as Pick<RcsaReview, "risk_id" | "reviewed_at">[],
        ),
      });
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
    const categoryId = filters.categoryId;
    const risks = snapshot.risks.filter((risk) =>
      matchesCategoryFilter(risk.category_id, categoryId),
    );
    const controls = snapshot.controls.filter((control) =>
      matchesInheritedCategory(
        snapshot.controlCategoryIds[control.id] ?? [],
        categoryId,
      ),
    );
    const incidents = snapshot.incidents.filter((incident) =>
      matchesInheritedCategory(
        snapshot.incidentCategoryIds[incident.id] ?? [],
        categoryId,
      ),
    );
    const issues = snapshot.issues.filter((issue) =>
      matchesInheritedCategory(
        snapshot.issueCategoryIds[issue.id] ?? [],
        categoryId,
      ),
    );
    const overdueControls = controls.filter(
      (control) =>
        getTestingStatus(control.last_tested_at, control.is_key) === "Overdue",
    );
    const myPersonId = personByEmail(people, user?.email)?.id ?? null;

    return {
      risks,
      riskCount: risks.filter(isActiveRisk).length,
      overdueControlCount: overdueControls.length,
      overdueKeyControlCount: overdueControls.filter((control) => control.is_key)
        .length,
      openIncidentCount: incidents.filter(
        (incident) =>
          incident.status === "open" || incident.status === "investigating",
      ).length,
      assignedToMe:
        risks.filter((risk) => risk.assignee_id === myPersonId).length +
        controls.filter((control) => control.assignee_id === myPersonId).length +
        incidents.filter((incident) => incident.assignee_id === myPersonId)
          .length +
        issues.filter((issue) => issue.assignee_id === myPersonId).length,
      appetiteBreaches: risks.filter((risk) =>
        isAppetiteBreach(risk, categories),
      ).length,
      issuesSummary: summariseIssues(issues, snapshot.actions),
      severityBands: buildSeverityBandCounts(risks),
      taxonomyCounts: buildTaxonomyRiskCounts(risks, categories),
      treatmentCounts: buildTreatmentCounts(risks),
      controlEffectiveness: buildControlEffectivenessCounts(controls),
      incidentStatus: buildIncidentStatusCounts(incidents),
      issueStatus: buildIssueStatusCounts(issues),
      issueSeverityBreakdown: buildOpenIssueSeverityBreakdown(issues),
      attention: buildAttentionItems(controls, incidents, issues, risks, {
        lastReviewedByRisk: snapshot.lastReviewedByRisk,
        linkedControlCounts: snapshot.linkedControlCounts,
        categories,
      }),
    };
  }, [categories, filters.categoryId, people, snapshot, user?.email]);

  const categoryQuery = filters.categoryId
    ? `&category=${encodeURIComponent(filters.categoryId)}`
    : "";

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <PageHeader
          title="Dashboard"
          description={user?.email ? `Welcome back, ${user.email}` : undefined}
          breadcrumbs={[{ label: "Home" }]}
          actions={
            schemaReady ? (
              <FilterSelect
                label="Taxonomy lens"
                value={filters.categoryId}
                onChange={(value) => updateFilters({ category: value })}
                options={categoryFilterOptions(categories)}
              />
            ) : undefined
          }
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading summary...</p>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            </section>

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

            <section className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Risk Heat Map"
                description="Click a cell to filter risks by likelihood and impact. Closed risks are excluded."
              >
                <div className="mt-2">
                  <RiskHeatMap risks={data.risks.filter(isActiveRisk)} />
                </div>
              </ChartCard>

              <ChartCard
                title="Risks by Risk Score"
                description="Click a bar to filter the risk register by risk score."
              >
                <RiskSeverityBarChart data={data.severityBands} />
              </ChartCard>

              {schemaReady && (
                <>
                  <ChartCard
                    title="Risks by taxonomy"
                    description="Click a bar to filter the risk register by category."
                  >
                    <TaxonomyBarChart data={data.taxonomyCounts} />
                  </ChartCard>
                  <ChartCard
                    title="Treatment mix"
                    description="How open risks are being treated. Click a bar to filter."
                  >
                    <TaxonomyBarChart
                      data={data.treatmentCounts}
                      queryParam="treatment"
                    />
                  </ChartCard>
                </>
              )}

              <ChartCard
                title="Issues by Status"
                description="Click a slice to filter the issue log."
              >
                <IssuesStatusDonut data={data.issueStatus} />
              </ChartCard>

              <ChartCard
                title="Remediation Health"
                description="Open issues by severity, and how far their action plans have progressed."
              >
                <RemediationHealth
                  summary={data.issuesSummary}
                  breakdown={data.issueSeverityBreakdown}
                />
              </ChartCard>

              <ChartCard
                title="Controls by Effectiveness"
                description="Click a slice to filter controls."
              >
                <ControlsEffectivenessDonut data={data.controlEffectiveness} />
              </ChartCard>

              <ChartCard
                title="Incidents by Status"
                description="Click a slice to filter incidents."
              >
                <IncidentsStatusDonut data={data.incidentStatus} />
              </ChartCard>
            </section>
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
