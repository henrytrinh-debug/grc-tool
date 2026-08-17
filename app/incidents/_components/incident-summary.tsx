import { ChartCard } from "@/app/components/dashboard/chart-card";
import { IncidentsStatusDonut } from "@/app/components/dashboard/donut-charts";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { LineTimeChart, StackedTimeChart } from "@/app/components/dashboard/time-charts";
import { IncidentSeverityDonut } from "@/app/components/oversight/oversight-donuts";
import { SummaryGrid } from "@/app/components/register-page-shell";
import {
  buildOpenedClosedTrend,
  stackByMonth,
} from "@/lib/charts/time-series";
import { buildIncidentStatusCounts } from "@/lib/dashboard/analytics";
import {
  buildIncidentSeverityCounts,
  buildIncidentStock,
} from "@/lib/oversight/metrics";
import { openIncidents } from "@/lib/metrics/kpis";
import type { Incident } from "@/lib/types/incident";

export function IncidentSummary({ incidents }: { incidents: Incident[] }) {
  const open = openIncidents(incidents);
  const stock = buildIncidentStock(incidents);
  const stacked = stackByMonth(
    incidents.map((incident) => ({
      date: incident.date_occurred,
      series: incident.severity,
    })),
    ["critical", "high", "medium", "low"],
  );
  const flow = buildOpenedClosedTrend(
    incidents.map((incident) => ({ date: incident.date_occurred })),
    incidents
      .filter((incident) => incident.resolved_at)
      .map((incident) => ({ date: incident.resolved_at })),
    "resolved",
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open incidents"
          value={open.length}
          href="/incidents?view=register&status=open,investigating"
          linkLabel="View open"
          hint="Open or investigating"
        />
        <StatCard
          label="Average age"
          value={stock.averageAgeDays === null ? "—" : `${stock.averageAgeDays}d`}
          hint="Open incidents, days since occurrence"
        />
        <StatCard
          label="High / Critical open"
          value={
            open.filter(
              (incident) =>
                incident.severity === "high" || incident.severity === "critical",
            ).length
          }
          href="/incidents?view=register&status=open,investigating&severity=high,critical"
          linkLabel="View severe open"
          tone={
            open.some(
              (incident) =>
                incident.severity === "high" || incident.severity === "critical",
            )
              ? "alert"
              : "default"
          }
        />
        <StatCard
          label="All incidents"
          value={incidents.length}
          href="/incidents?view=register"
          linkLabel="Open register"
        />
      </section>

      <SummaryGrid>
        <ChartCard
          title="By status"
          description="Click a slice to filter the register."
        >
          <IncidentsStatusDonut data={buildIncidentStatusCounts(incidents)} />
        </ChartCard>
        <ChartCard
          title="By severity"
          description="Click a slice to filter the register."
        >
          <IncidentSeverityDonut data={buildIncidentSeverityCounts(incidents)} />
        </ChartCard>
        <ChartCard
          title="Occurred by month"
          description="Last 12 months, stacked by severity."
        >
          <StackedTimeChart
            data={stacked}
            series={[
              { key: "critical", label: "Critical" },
              { key: "high", label: "High" },
              { key: "medium", label: "Medium" },
              { key: "low", label: "Low" },
            ]}
            empty="No incidents in the last 12 months."
          />
        </ChartCard>
        <ChartCard
          title="Opened vs resolved"
          description="New incidents versus resolved stamps, last 12 months."
        >
          <LineTimeChart
            data={flow}
            series={[
              { key: "opened", label: "Occurred" },
              { key: "resolved", label: "Resolved" },
            ]}
            empty="No incident flow in the last 12 months."
          />
        </ChartCard>
      </SummaryGrid>
    </div>
  );
}
