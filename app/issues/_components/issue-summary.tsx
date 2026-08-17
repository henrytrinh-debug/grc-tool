import { ChartCard } from "@/app/components/dashboard/chart-card";
import { IssuesStatusDonut } from "@/app/components/dashboard/donut-charts";
import { RemediationHealth } from "@/app/components/dashboard/remediation-health";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { LineTimeChart } from "@/app/components/dashboard/time-charts";
import { IssueAgingChart } from "@/app/components/oversight/aging-chart";
import { OpenIssuesBySourceDonut } from "@/app/components/oversight/oversight-donuts";
import { SummaryGrid } from "@/app/components/register-page-shell";
import { buildOpenedClosedTrend } from "@/lib/charts/time-series";
import {
  buildIssueStatusCounts,
  buildOpenIssueSeverityBreakdown,
  summariseIssues,
} from "@/lib/dashboard/analytics";
import {
  buildOpenIssueAgingBuckets,
  buildOpenIssuesBySource,
} from "@/lib/oversight/metrics";
import { isIssueOverdue } from "@/lib/types/issue";
import type { Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";

export function IssueSummary({
  issues,
  actions,
}: {
  issues: Issue[];
  actions: IssueAction[];
}) {
  const summary = summariseIssues(issues, actions);
  const overdue = issues.filter((issue) => isIssueOverdue(issue)).length;
  const flow = buildOpenedClosedTrend(
    issues.map((issue) => ({ date: issue.identified_at })),
    issues
      .filter((issue) => issue.closed_at)
      .map((issue) => ({ date: issue.closed_at })),
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open issues"
          value={summary.open}
          href="/issues?view=register&status=open,in_progress,pending_review"
          linkLabel="View open"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          href="/issues?view=register&overdue=true"
          linkLabel="View overdue"
          tone={overdue > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Action-plan completion"
          value={`${summary.actionCompletionPercent}%`}
          hint="Across open issues"
        />
        <StatCard
          label="All issues"
          value={issues.length}
          href="/issues?view=register"
          linkLabel="Open register"
        />
      </section>

      <SummaryGrid>
        <ChartCard
          title="By status"
          description="Click a slice to filter the log."
        >
          <IssuesStatusDonut data={buildIssueStatusCounts(issues)} />
        </ChartCard>
        <ChartCard
          title="Remediation health"
          description="Open issues by severity, and how far action plans have progressed."
        >
          <RemediationHealth
            summary={summary}
            breakdown={buildOpenIssueSeverityBreakdown(issues)}
          />
        </ChartCard>
        <ChartCard
          title="Open issue aging"
          description="Days since identification, by severity."
        >
          <IssueAgingChart data={buildOpenIssueAgingBuckets(issues)} />
        </ChartCard>
        <ChartCard
          title="Opened vs closed"
          description="Identified versus closed in the last 12 months."
        >
          <LineTimeChart
            data={flow}
            series={[
              { key: "opened", label: "Opened" },
              { key: "closed", label: "Closed" },
            ]}
            empty="No issue flow in the last 12 months."
          />
        </ChartCard>
        <ChartCard
          title="Open issues by source"
          description="Which upstream process is generating findings."
        >
          <OpenIssuesBySourceDonut data={buildOpenIssuesBySource(issues)} />
        </ChartCard>
      </SummaryGrid>
    </div>
  );
}
