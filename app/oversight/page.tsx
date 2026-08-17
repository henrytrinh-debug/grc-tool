"use client";

import { useCallback, useState } from "react";
import { ChartCard } from "@/app/components/dashboard/chart-card";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { LineTimeChart, StackedTimeChart } from "@/app/components/dashboard/time-charts";
import {
  StaleReviewsBreakdownList,
  UncontrolledRisksBreakdownList,
} from "@/app/components/oversight/breakdown-rows";
import { FlowBarChart } from "@/app/components/oversight/flow-chart";
import { IssueAgingChart } from "@/app/components/oversight/aging-chart";
import { RatingMovementList } from "@/app/components/oversight/movement-list";
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import { mutedTextClassName } from "@/app/components/ui";
import {
  buildOpenedClosedTrend,
  buildOperatingTrend,
  OPERATING_TREND_SERIES,
} from "@/lib/charts/time-series";
import { useSettings } from "@/lib/settings/context";
import {
  isOversightSectionVisible,
  type OversightSectionId,
} from "@/lib/settings/preferences";
import {
  formatKeyTestingCadenceHint,
  formatReviewCadenceHint,
} from "@/lib/settings/store";
import { appetiteBreachingRisks } from "@/lib/metrics/kpis";
import {
  buildIncidentFlow,
  buildIncidentStock,
  buildIssueFlow,
  buildOpenIssueAgingBuckets,
  buildStaleReviewBreakdown,
  buildTestingCoverage,
  buildTestPassRate,
  buildUncontrolledRisks,
  countOrphanedControls,
  countReviewsDue,
  getOpenIssueOverduePercent,
  type IncidentFlow,
  type IncidentStock,
  type IssueAgingBucket,
  type IssueFlow,
  type StaleReviewBreakdown,
  type TestPassRate,
  type UncontrolledRiskBreakdown,
} from "@/lib/oversight/metrics";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { buildRatingMovement, type RatingMovementSummary } from "@/lib/oversight/movement";
import { fetchGrcSnapshot } from "@/lib/snapshot/grc-snapshot";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import {
  fallbackResolvedAt,
  type Incident,
} from "@/lib/types/incident";
import {
  obligationCoverage,
  type ObligationRecord,
} from "@/lib/types/obligation";
import type { ObligationControlLink } from "@/lib/types/obligation-links";

type OversightData = {
  keyTestingOverdue: number;
  testPassRate: TestPassRate;
  uncontrolledRisks: UncontrolledRiskBreakdown[];
  staleReviews: StaleReviewBreakdown;
  reviewsDue: number;
  orphanedControls: number;
  agingBuckets: IssueAgingBucket[];
  issueFlow: IssueFlow;
  openIssueOverduePercent: number;
  incidentStock: IncidentStock;
  incidentFlow: IncidentFlow;
  appetiteBreaches: number;
  ratingMovement: RatingMovementSummary;
  obligationCoverage: {
    active: number;
    covered: number;
    uncovered: number;
  } | null;
  operatingTrend: ReturnType<typeof buildOperatingTrend>;
  issueMonthly: ReturnType<typeof buildOpenedClosedTrend>;
  incidentMonthly: ReturnType<typeof buildOpenedClosedTrend>;
};

const emptyData: OversightData = {
  keyTestingOverdue: 0,
  testPassRate: {
    effectiveCount: 0,
    ineffectiveCount: 0,
    totalRecorded: 0,
    passRatePercent: null,
  },
  uncontrolledRisks: [],
  staleReviews: { never: 0, within180: 0, between180And365: 0, over365: 0 },
  reviewsDue: 0,
  orphanedControls: 0,
  agingBuckets: [],
  issueFlow: { last30: { opened: 0, closed: 0 }, last90: { opened: 0, closed: 0 } },
  openIssueOverduePercent: 0,
  incidentStock: { openCount: 0, averageAgeDays: null },
  incidentFlow: {
    last30: { opened: 0, closed: 0 },
    last90: { opened: 0, closed: 0 },
    hasResolvedData: false,
  },
  appetiteBreaches: 0,
  ratingMovement: {
    reviewed: 0,
    increased: 0,
    decreased: 0,
    unchanged: 0,
    moves: [],
  },
  obligationCoverage: null,
  operatingTrend: [],
  issueMonthly: [],
  incidentMonthly: [],
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
  const { settings, categories, obligationsReady } = useSettings();
  const [data, setData] = useState<OversightData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOversightData = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const snapshot = await fetchGrcSnapshot(
        supabase,
        ownerId,
        "oversight",
      );
      const {
        risks,
        controls,
        issues,
        reviews,
        tests: testResults,
        riskControlLinks,
      } = snapshot;
      const incidents = await stampMissingResolvedAt(
        supabase,
        ownerId,
        snapshot.incidents,
      );

      const keyControls = controls.filter((control) => control.is_key);
      const [obligationRows, obligationLinks] = obligationsReady
        ? await Promise.all([
            fetchOwnedTableOptional<ObligationRecord>(
              supabase,
              "obligations",
              ownerId,
            ),
            fetchOwnedTableOptional<ObligationControlLink>(
              supabase,
              "obligation_controls",
              ownerId,
              { columns: "obligation_id, control_id" },
            ),
          ])
        : [
            [] as ObligationRecord[],
            [] as ObligationControlLink[],
          ];

      setData({
        keyTestingOverdue: buildTestingCoverage(keyControls).overdue,
        testPassRate: buildTestPassRate(testResults),
        uncontrolledRisks: buildUncontrolledRisks(risks, riskControlLinks),
        staleReviews: buildStaleReviewBreakdown(risks, reviews),
        reviewsDue: countReviewsDue(risks, reviews),
        orphanedControls: countOrphanedControls(controls, riskControlLinks),
        agingBuckets: buildOpenIssueAgingBuckets(issues),
        issueFlow: buildIssueFlow(issues),
        openIssueOverduePercent: getOpenIssueOverduePercent(issues),
        incidentStock: buildIncidentStock(incidents),
        incidentFlow: buildIncidentFlow(incidents),
        appetiteBreaches: appetiteBreachingRisks(risks, categories).length,
        ratingMovement: buildRatingMovement(reviews, risks),
        obligationCoverage: obligationsReady
          ? obligationCoverage(obligationRows, obligationLinks)
          : null,
        operatingTrend: buildOperatingTrend({
          incidents,
          issues,
          tests: testResults,
        }),
        issueMonthly: buildOpenedClosedTrend(
          issues.map((issue) => ({ date: issue.identified_at })),
          issues
            .filter((issue) => issue.closed_at)
            .map((issue) => ({ date: issue.closed_at })),
        ),
        incidentMonthly: buildOpenedClosedTrend(
          incidents.map((incident) => ({ date: incident.date_occurred })),
          incidents
            .filter((incident) => incident.resolved_at)
            .map((incident) => ({ date: incident.resolved_at })),
          "resolved",
        ),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load oversight data",
      );
    } finally {
      setLoading(false);
    }
  }, [categories, obligationsReady]);

  const { authLoading } = useRequireAuth(fetchOversightData);

  if (authLoading) {
    return <PageLoading />;
  }

  const uncontrolledHighOrCriticalCount = data.uncontrolledRisks
    .filter((row) => row.band === "High" || row.band === "Critical")
    .reduce((sum, row) => sum + row.count, 0);
  const showSection = (id: OversightSectionId) =>
    isOversightSectionVisible(settings.workspacePreferences, id);

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <PageHeader
          title="Oversight Monitoring"
          description="Cross-register Second Line view of health, flow, and rating movement. Asset-specific charts live on each register’s Summary tab."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Oversight" },
          ]}
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading oversight data...</p>
        ) : (
          <>
            {showSection("health") ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Cross-register health
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  Coverage gaps that cut across risks, controls, findings, and obligations.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Key controls overdue"
                  value={data.keyTestingOverdue}
                  hint={formatKeyTestingCadenceHint(settings)}
                  href="/controls?isKey=true&testingStatus=Overdue"
                  linkLabel="View overdue key controls"
                  tone={data.keyTestingOverdue > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Uncontrolled High / Critical"
                  value={uncontrolledHighOrCriticalCount}
                  href="/risks?uncontrolled=true&severity=High,Critical"
                  linkLabel="View uncontrolled exposure"
                  tone={uncontrolledHighOrCriticalCount > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Reviews due"
                  value={data.reviewsDue}
                  hint={formatReviewCadenceHint(settings)}
                  href="/risks?reviewRecency=due"
                  linkLabel="View risks due"
                  tone={data.reviewsDue > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Above appetite"
                  value={data.appetiteBreaches}
                  href="/risks?appetiteBreach=true"
                  linkLabel="View appetite breaches"
                  tone={data.appetiteBreaches > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Open issues overdue"
                  value={`${data.openIssueOverduePercent}%`}
                  href="/issues?overdue=true"
                  linkLabel="View overdue issues"
                  tone={data.openIssueOverduePercent > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Open incident age"
                  value={
                    data.incidentStock.averageAgeDays === null
                      ? "—"
                      : `${data.incidentStock.averageAgeDays}d`
                  }
                  hint={`${data.incidentStock.openCount} open or investigating`}
                  href="/incidents?status=open,investigating"
                  linkLabel="View open incidents"
                />
                <StatCard
                  label="Unmapped controls"
                  value={data.orphanedControls}
                  href="/controls?unmapped=true"
                  linkLabel="View unmapped"
                  tone={data.orphanedControls > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Test pass rate"
                  value={
                    data.testPassRate.passRatePercent === null
                      ? "—"
                      : `${data.testPassRate.passRatePercent}%`
                  }
                  hint={`${data.testPassRate.totalRecorded} tests recorded`}
                />
                {data.obligationCoverage ? (
                  <StatCard
                    label="Obligation coverage gaps"
                    value={data.obligationCoverage.uncovered}
                    hint={`${data.obligationCoverage.covered}/${data.obligationCoverage.active} mapped`}
                    href="/quality"
                    linkLabel="Open data quality"
                    tone={
                      data.obligationCoverage.uncovered > 0 ? "alert" : "default"
                    }
                  />
                ) : null}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Operating volume"
                  description="Incidents, issues, and control tests across the last 12 months."
                >
                  <StackedTimeChart
                    data={data.operatingTrend}
                    series={[...OPERATING_TREND_SERIES]}
                    empty="No operating volume in the last 12 months."
                  />
                </ChartCard>
                <ChartCard
                  title="Uncontrolled risk exposure"
                  description="Active risks with no linked control, by severity band."
                >
                  <UncontrolledRisksBreakdownList breakdown={data.uncontrolledRisks} />
                </ChartCard>
              </div>
            </section>
            ) : null}

            {showSection("flow") ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Flow and aging
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  Whether findings and incidents are being closed as quickly as they arrive.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Open issue aging"
                  description="Days since identification, by severity."
                >
                  <IssueAgingChart data={data.agingBuckets} />
                </ChartCard>
                <ChartCard
                  title="Issue flow"
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
                  title="Issues opened vs closed"
                  description="Monthly identification versus closure."
                >
                  <LineTimeChart
                    data={data.issueMonthly}
                    series={[
                      { key: "opened", label: "Opened" },
                      { key: "closed", label: "Closed" },
                    ]}
                    empty="No issue flow in the last 12 months."
                  />
                </ChartCard>
                <ChartCard
                  title="Incident flow"
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
                  title="Incidents occurred vs resolved"
                  description="Monthly occurrence versus resolution."
                >
                  <LineTimeChart
                    data={data.incidentMonthly}
                    series={[
                      { key: "opened", label: "Occurred" },
                      { key: "resolved", label: "Resolved" },
                    ]}
                    empty="No incident flow in the last 12 months."
                  />
                </ChartCard>
              </div>
            </section>
            ) : null}

            {showSection("movement") ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Rating movement
                </h2>
                <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                  How inherent scores are changing, and whether reviews are current.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Scores increased"
                  value={data.ratingMovement.increased}
                  hint={`Latest RCSA vs prior rating · ${data.ratingMovement.reviewed} reviewed`}
                />
                <StatCard
                  label="Scores decreased"
                  value={data.ratingMovement.decreased}
                  hint="Latest RCSA vs prior rating"
                />
                <StatCard
                  label="Never reviewed"
                  value={data.staleReviews.never}
                  href="/risks?reviewRecency=never"
                  linkLabel="View never-reviewed risks"
                  tone={data.staleReviews.never > 0 ? "alert" : "default"}
                />
                <StatCard
                  label="Reviewed within 180 days"
                  value={data.staleReviews.within180}
                  hint="Currently in good standing"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Rating movement"
                  description="Latest assessment vs the score the reviewer started from. Tightening (down) is usually the healthy direction."
                >
                  <RatingMovementList summary={data.ratingMovement} />
                </ChartCard>
                <ChartCard
                  title="Review recency"
                  description="Time since each risk's last RCSA review."
                >
                  <StaleReviewsBreakdownList
                    breakdown={data.staleReviews}
                    dueCount={data.reviewsDue}
                  />
                </ChartCard>
              </div>
            </section>
            ) : null}

            {!showSection("health") &&
            !showSection("flow") &&
            !showSection("movement") ? (
              <p className={mutedTextClassName}>
                Oversight sections are hidden. Restore them from Admin → Workspace.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
