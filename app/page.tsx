"use client";

import { useCallback, useState } from "react";
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
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import { mutedTextClassName } from "@/app/components/ui";
import {
  buildControlEffectivenessCounts,
  buildIncidentStatusCounts,
  buildIssueStatusCounts,
  buildOpenIssueSeverityBreakdown,
  buildSeverityBandCounts,
  summariseIssues,
  type ChartCount,
  type IssueSeverityBreakdown,
  type IssueSummary,
  type SeverityBandCount,
} from "@/lib/dashboard/analytics";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getTestingStatus, type Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";
import type { Risk } from "@/lib/types/risk";

type DashboardData = {
  riskCount: number;
  overdueControlCount: number;
  openIncidentCount: number;
  issues: IssueSummary;
  risks: Risk[];
  severityBands: SeverityBandCount[];
  controlEffectiveness: ChartCount[];
  incidentStatus: ChartCount[];
  issueStatus: ChartCount[];
  issueSeverityBreakdown: IssueSeverityBreakdown[];
};

const emptyDashboard: DashboardData = {
  riskCount: 0,
  overdueControlCount: 0,
  openIncidentCount: 0,
  issues: {
    total: 0,
    open: 0,
    overdue: 0,
    awaitingReview: 0,
    actionCompletionPercent: 0,
  },
  risks: [],
  severityBands: [],
  controlEffectiveness: [],
  incidentStatus: [],
  issueStatus: [],
  issueSeverityBreakdown: [],
};

export default function HomePage() {
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const results = await Promise.all([
        supabase.from("risks").select("*").eq("owner_id", ownerId),
        supabase.from("controls").select("*").eq("owner_id", ownerId),
        supabase.from("incidents").select("*").eq("owner_id", ownerId),
        supabase.from("issues").select("*").eq("owner_id", ownerId),
        supabase.from("issue_actions").select("*").eq("owner_id", ownerId),
      ]);

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw failed.error;
      }

      const [risksResult, controlsResult, incidentsResult, issuesResult, actionsResult] =
        results;

      const risks = (risksResult.data ?? []) as Risk[];
      const controls = (controlsResult.data ?? []) as Control[];
      const incidents = (incidentsResult.data ?? []) as Incident[];
      const issues = (issuesResult.data ?? []) as Issue[];
      const actions = (actionsResult.data ?? []) as IssueAction[];

      setData({
        riskCount: risks.length,
        overdueControlCount: controls.filter(
          (control) => getTestingStatus(control.last_tested_at) === "Overdue",
        ).length,
        openIncidentCount: incidents.filter(
          (incident) =>
            incident.status === "open" || incident.status === "investigating",
        ).length,
        issues: summariseIssues(issues, actions),
        risks,
        severityBands: buildSeverityBandCounts(risks),
        controlEffectiveness: buildControlEffectivenessCounts(controls),
        incidentStatus: buildIncidentStatusCounts(incidents),
        issueStatus: buildIssueStatusCounts(issues),
        issueSeverityBreakdown: buildOpenIssueSeverityBreakdown(issues),
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

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <PageHeader
          title="Dashboard"
          description={user?.email ? `Welcome back, ${user.email}` : undefined}
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading summary...</p>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Risks"
                value={data.riskCount}
                href="/risks"
                linkLabel="View risk register"
              />
              <StatCard
                label="Overdue Controls"
                value={data.overdueControlCount}
                href="/controls?testingStatus=Overdue"
                linkLabel="View overdue controls"
                tone={data.overdueControlCount > 0 ? "alert" : "default"}
              />
              <StatCard
                label="Open Incidents"
                value={data.openIncidentCount}
                href="/incidents?status=open,investigating"
                linkLabel="View open incidents"
                hint="Status open or investigating"
              />
              <StatCard
                label="Open Issues"
                value={data.issues.open}
                href="/issues?status=open,in_progress,pending_review"
                linkLabel={
                  data.issues.overdue > 0
                    ? `${data.issues.overdue} past target date`
                    : "View open issues"
                }
                hint="Findings awaiting remediation"
                tone={data.issues.overdue > 0 ? "alert" : "default"}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Risk Heat Map"
                description="Click a cell to filter risks by likelihood and impact."
              >
                <div className="mt-2">
                  <RiskHeatMap risks={data.risks} />
                </div>
              </ChartCard>

              <ChartCard
                title="Risks by Risk Score"
                description="Click a bar to filter the risk register by risk score."
              >
                <RiskSeverityBarChart data={data.severityBands} />
              </ChartCard>

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
                  summary={data.issues}
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
