"use client";

import { useCallback, useState } from "react";
import { ChartCard } from "@/app/components/dashboard/chart-card";
import { RiskSeverityBarChart } from "@/app/components/dashboard/risk-severity-bar-chart";
import { StatCard } from "@/app/components/dashboard/stat-card";
import {
  StaleReviewsBreakdownList,
  UncontrolledRisksBreakdownList,
} from "@/app/components/oversight/breakdown-rows";
import { FlowBarChart } from "@/app/components/oversight/flow-chart";
import {
  ControlKeySplitDonut,
  IncidentSeverityDonut,
  OpenIssuesBySourceDonut,
  TestingCoverageDonut,
} from "@/app/components/oversight/oversight-donuts";
import { IssueAgingChart } from "@/app/components/oversight/aging-chart";
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import { mutedTextClassName } from "@/app/components/ui";
import {
  buildSeverityBandCounts,
  summariseIssues,
  type IssueSummary,
  type SeverityBandCount,
} from "@/lib/dashboard/analytics";
import {
  buildAvgDaysToCloseIssues,
  buildAvgDaysToResolveIncidents,
  buildControlKeyStats,
  buildIncidentFlow,
  buildIncidentSeverityCounts,
  buildIncidentStock,
  buildIssueFlow,
  buildOpenIssueAgingBuckets,
  buildOpenIssuesBySource,
  buildStaleReviewBreakdown,
  buildTestingCoverage,
  buildTestPassRate,
  buildUncontrolledRisks,
  countOrphanedControls,
  countReviewsDue,
  getOpenIssueOverduePercent,
  toControlKeySplitChartCounts,
  toTestingCoverageChartCounts,
  type ControlKeyStats,
  type IncidentFlow,
  type IncidentStock,
  type IssueAgingBucket,
  type IssueFlow,
  type StaleReviewBreakdown,
  type TestingCoverage,
  type TestPassRate,
  type UncontrolledRiskBreakdown,
} from "@/lib/oversight/metrics";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import type { ControlTestResult } from "@/lib/types/control-test-result";
import {
  fallbackResolvedAt,
  type Incident,
} from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";
import type { Risk } from "@/lib/types/risk";
import type { ChartCount } from "@/lib/dashboard/analytics";

type OversightData = {
  controlKeyStats: ControlKeyStats;
  allTestingCoverage: TestingCoverage;
  keyTestingCoverage: TestingCoverage;
  testPassRate: TestPassRate;
  uncontrolledRisks: UncontrolledRiskBreakdown[];
  severityBands: SeverityBandCount[];
  staleReviews: StaleReviewBreakdown;
  reviewsDue: number;
  orphanedControls: number;
  agingBuckets: IssueAgingBucket[];
  issueFlow: IssueFlow;
  issuesSummary: IssueSummary;
  openIssueOverduePercent: number;
  avgDaysToCloseIssues: number | null;
  openIssuesBySource: ChartCount[];
  incidentStock: IncidentStock;
  incidentFlow: IncidentFlow;
  avgDaysToResolveIncidents: number | null;
  incidentSeverityCounts: ChartCount[];
};

const emptyIssueSummary: IssueSummary = {
  total: 0,
  open: 0,
  overdue: 0,
  awaitingReview: 0,
  actionCompletionPercent: 0,
};

const emptyData: OversightData = {
  controlKeyStats: { total: 0, key: 0, nonKey: 0, keyPercent: 0 },
  allTestingCoverage: { neverTested: 0, tested: 0, overdue: 0 },
  keyTestingCoverage: { neverTested: 0, tested: 0, overdue: 0 },
  testPassRate: {
    effectiveCount: 0,
    ineffectiveCount: 0,
    totalRecorded: 0,
    passRatePercent: null,
  },
  uncontrolledRisks: [],
  severityBands: [],
  staleReviews: { never: 0, within180: 0, between180And365: 0, over365: 0 },
  reviewsDue: 0,
  orphanedControls: 0,
  agingBuckets: [],
  issueFlow: { last30: { opened: 0, closed: 0 }, last90: { opened: 0, closed: 0 } },
  issuesSummary: emptyIssueSummary,
  openIssueOverduePercent: 0,
  avgDaysToCloseIssues: null,
  openIssuesBySource: [],
  incidentStock: { openCount: 0, averageAgeDays: null },
  incidentFlow: {
    last30: { opened: 0, closed: 0 },
    last90: { opened: 0, closed: 0 },
    hasResolvedData: false,
  },
  avgDaysToResolveIncidents: null,
  incidentSeverityCounts: [],
};

/**
 * Incidents already marked resolved before `resolved_at` existed never got a
 * stamp. Write one from `created_at` so flow/MTTR can populate without
 * re-saving each record. Failures (column not yet migrated) are ignored.
 */
async function stampMissingResolvedAt(
  supabase: ReturnType<typeof getSupabaseClient>,
  ownerId: string,
  incidents: Incident[],
): Promise<Incident[]> {
  const missing = incidents.filter(
    (incident) => incident.status === "resolved" && !incident.resolved_at,
  );

  if (missing.length === 0) {
    return incidents;
  }

  const stamped = await Promise.all(
    missing.map(async (incident) => {
      const resolvedAt = fallbackResolvedAt(incident);
      const { error } = await supabase
        .from("incidents")
        .update({ resolved_at: resolvedAt })
        .eq("id", incident.id)
        .eq("owner_id", ownerId);

      if (error) {
        return incident;
      }

      return { ...incident, resolved_at: resolvedAt };
    }),
  );

  const stampedById = new Map(
    stamped.map((incident) => [incident.id, incident]),
  );

  return incidents.map(
    (incident) => stampedById.get(incident.id) ?? incident,
  );
}

export default function OversightPage() {
  const [data, setData] = useState<OversightData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOversightData = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const results = await Promise.all([
        supabase.from("risks").select("*").eq("owner_id", ownerId),
        supabase.from("controls").select("*").eq("owner_id", ownerId),
        supabase.from("control_test_results").select("*").eq("owner_id", ownerId),
        supabase.from("incidents").select("*").eq("owner_id", ownerId),
        supabase.from("issues").select("*").eq("owner_id", ownerId),
        supabase.from("issue_actions").select("*").eq("owner_id", ownerId),
        supabase.from("risk_controls").select("risk_id, control_id").eq("owner_id", ownerId),
        supabase
          .from("rcsa_reviews")
          .select("risk_id, reviewed_at")
          .eq("owner_id", ownerId),
      ]);

      throwIfAnyQueryError(results);

      const [
        risksResult,
        controlsResult,
        testResultsResult,
        incidentsResult,
        issuesResult,
        actionsResult,
        riskControlsResult,
        reviewsResult,
      ] = results;

      const risks = (risksResult.data ?? []) as Risk[];
      const controls = (controlsResult.data ?? []) as Control[];
      const testResults = (testResultsResult.data ?? []) as ControlTestResult[];
      const incidents = await stampMissingResolvedAt(
        supabase,
        ownerId,
        (incidentsResult.data ?? []) as Incident[],
      );
      const issues = (issuesResult.data ?? []) as Issue[];
      const actions = (actionsResult.data ?? []) as IssueAction[];
      const riskControlLinks = (riskControlsResult.data ?? []) as {
        risk_id: string;
        control_id: string;
      }[];
      const reviews = (reviewsResult.data ?? []) as {
        risk_id: string;
        reviewed_at: string;
      }[];

      const keyControls = controls.filter((control) => control.is_key);

      setData({
        controlKeyStats: buildControlKeyStats(controls),
        allTestingCoverage: buildTestingCoverage(controls),
        keyTestingCoverage: buildTestingCoverage(keyControls),
        testPassRate: buildTestPassRate(testResults),
        uncontrolledRisks: buildUncontrolledRisks(risks, riskControlLinks),
        severityBands: buildSeverityBandCounts(risks),
        staleReviews: buildStaleReviewBreakdown(risks, reviews),
        reviewsDue: countReviewsDue(risks, reviews),
        orphanedControls: countOrphanedControls(controls, riskControlLinks),
        agingBuckets: buildOpenIssueAgingBuckets(issues),
        issueFlow: buildIssueFlow(issues),
        issuesSummary: summariseIssues(issues, actions),
        openIssueOverduePercent: getOpenIssueOverduePercent(issues),
        avgDaysToCloseIssues: buildAvgDaysToCloseIssues(issues),
        openIssuesBySource: buildOpenIssuesBySource(issues),
        incidentStock: buildIncidentStock(incidents),
        incidentFlow: buildIncidentFlow(incidents),
        avgDaysToResolveIncidents: buildAvgDaysToResolveIncidents(incidents),
        incidentSeverityCounts: buildIncidentSeverityCounts(incidents),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load oversight data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(fetchOversightData);

  if (authLoading) {
    return <PageLoading />;
  }

  const keyControlsOverdueCount = data.keyTestingCoverage.overdue;
  const uncontrolledTotal = data.uncontrolledRisks.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const uncontrolledHighOrCriticalCount = data.uncontrolledRisks
    .filter((row) => row.band === "High" || row.band === "Critical")
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <PageHeader
          title="Oversight Monitoring"
          description="A Second Line of Defence view of coverage, aging, and stock/flow trends across the risk and control environment."
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading oversight data...</p>
        ) : (
          <>
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Controls
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  Coverage and design of the control environment.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Key Controls"
                  value={`${data.controlKeyStats.key}/${data.controlKeyStats.total}`}
                  hint={`${data.controlKeyStats.keyPercent}% of the control environment`}
                  href="/controls?isKey=true"
                  linkLabel="View key controls"
                />
                <StatCard
                  label="Key Controls Overdue"
                  value={keyControlsOverdueCount}
                  hint="Key controls not tested within 180 days"
                  href="/controls?isKey=true&testingStatus=Overdue"
                  linkLabel="View overdue key controls"
                  tone={keyControlsOverdueCount > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Test Pass Rate"
                  value={
                    data.testPassRate.passRatePercent === null
                      ? "—"
                      : `${data.testPassRate.passRatePercent}%`
                  }
                  hint={`${data.testPassRate.totalRecorded} tests recorded`}
                />
                <StatCard
                  label="Uncontrolled Risk Exposure"
                  value={uncontrolledTotal}
                  hint="Risks with zero linked controls"
                  href="/risks?uncontrolled=true"
                  linkLabel="View uncontrolled risks"
                  tone={uncontrolledHighOrCriticalCount > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Unmapped Controls"
                  value={data.orphanedControls}
                  hint="Controls with no linked risk"
                  href="/controls?unmapped=true"
                  linkLabel="View unmapped controls"
                  tone={data.orphanedControls > 0 ? "alert" : "default"}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Testing Coverage — All Controls"
                  description="Click a slice to filter the control register."
                >
                  <TestingCoverageDonut
                    data={toTestingCoverageChartCounts(data.allTestingCoverage)}
                  />
                </ChartCard>

                <ChartCard
                  title="Testing Coverage — Key Controls"
                  description="Same breakdown, restricted to key controls."
                >
                  <TestingCoverageDonut
                    data={toTestingCoverageChartCounts(data.keyTestingCoverage)}
                    extraParams={{ isKey: "true" }}
                  />
                </ChartCard>

                <ChartCard
                  title="Key vs Non-Key Controls"
                  description="Click a slice to filter the control register."
                >
                  <ControlKeySplitDonut
                    data={toControlKeySplitChartCounts(data.controlKeyStats)}
                  />
                </ChartCard>

                <ChartCard
                  title="Uncontrolled Risk Exposure"
                  description="Risks with no linked control, by severity band."
                >
                  <UncontrolledRisksBreakdownList breakdown={data.uncontrolledRisks} />
                </ChartCard>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Risks
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  Distribution and review currency of the risk register.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Risks"
                  value={data.severityBands.reduce((sum, band) => sum + band.count, 0)}
                  href="/risks"
                  linkLabel="View risk register"
                />
                <StatCard
                  label="Due for Review"
                  value={data.reviewsDue}
                  hint="Past the 90/180/365-day cadence for the current score"
                  href="/risks?reviewRecency=due"
                  linkLabel="View risks due for review"
                  tone={data.reviewsDue > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Never Reviewed"
                  value={data.staleReviews.never}
                  hint="No RCSA review on record"
                  href="/risks?reviewRecency=never"
                  linkLabel="View never-reviewed risks"
                  tone={data.staleReviews.never > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Reviewed Within 180 Days"
                  value={data.staleReviews.within180}
                  hint="Currently in good standing"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Risks by Risk Score"
                  description="Click a bar to filter the risk register by risk score."
                >
                  <RiskSeverityBarChart data={data.severityBands} />
                </ChartCard>

                <ChartCard
                  title="Review Recency"
                  description="Time since each risk's last RCSA review."
                >
                  <StaleReviewsBreakdownList
                    breakdown={data.staleReviews}
                    dueCount={data.reviewsDue}
                  />
                </ChartCard>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Issues &amp; Remediation
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  Whether remediation is keeping pace with new findings.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Open Issues"
                  value={data.issuesSummary.open}
                  href="/issues?status=open,in_progress,pending_review"
                  linkLabel="View open issues"
                />
                <StatCard
                  label="% Open Issues Overdue"
                  value={`${data.openIssueOverduePercent}%`}
                  href="/issues?overdue=true"
                  linkLabel="View overdue issues"
                  tone={data.openIssueOverduePercent > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Avg Action Plan Completion"
                  value={`${data.issuesSummary.actionCompletionPercent}%`}
                  hint="Across open issues"
                />
                <StatCard
                  label="Avg Days to Close"
                  value={
                    data.avgDaysToCloseIssues === null
                      ? "—"
                      : data.avgDaysToCloseIssues
                  }
                  hint="Identified to closed"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Open Issue Aging"
                  description="Days since identification, by severity."
                >
                  <IssueAgingChart data={data.agingBuckets} />
                </ChartCard>

                <ChartCard
                  title="Issue Flow"
                  description="Opened vs closed, trailing 30 / 90 days."
                >
                  <FlowBarChart
                    last30={data.issueFlow.last30}
                    last90={data.issueFlow.last90}
                    openedLabel="Opened"
                    closedLabel="Closed"
                    emptyMessage="No issues opened or closed in this window."
                  />
                </ChartCard>

                <ChartCard
                  title="Open Issues by Source"
                  description="Which upstream process is generating the most findings."
                >
                  <OpenIssuesBySourceDonut data={data.openIssuesBySource} />
                </ChartCard>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Incidents
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  Open incident stock and resolution flow.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Open Incidents"
                  value={data.incidentStock.openCount}
                  hint="Status open or investigating"
                  href="/incidents?status=open,investigating"
                  linkLabel="View open incidents"
                />
                <StatCard
                  label="Avg Age (Open)"
                  value={
                    data.incidentStock.averageAgeDays === null
                      ? "—"
                      : `${data.incidentStock.averageAgeDays}d`
                  }
                  hint="Days since occurrence"
                />
                <StatCard
                  label="Avg Days to Resolve"
                  value={
                    data.avgDaysToResolveIncidents === null
                      ? "—"
                      : data.avgDaysToResolveIncidents
                  }
                  hint="Occurred to resolved"
                />
                <StatCard
                  label="Resolved (Last 30 Days)"
                  value={data.incidentFlow.last30.closed}
                  href="/incidents?status=resolved"
                  linkLabel="View resolved incidents"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Incident Flow"
                  description="New vs resolved, trailing 30 / 90 days."
                >
                  <FlowBarChart
                    last30={data.incidentFlow.last30}
                    last90={data.incidentFlow.last90}
                    openedLabel="New"
                    closedLabel="Resolved"
                    emptyMessage="No incidents occurred or were resolved in this window."
                  />
                </ChartCard>

                <ChartCard
                  title="Incidents by Severity"
                  description="Click a slice to filter incidents."
                >
                  <IncidentSeverityDonut data={data.incidentSeverityCounts} />
                </ChartCard>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
