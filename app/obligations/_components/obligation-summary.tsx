import { ChartCard } from "@/app/components/dashboard/chart-card";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { TaxonomyBarChart } from "@/app/components/dashboard/taxonomy-bar-chart";
import { RecordLinkList } from "@/app/components/record-link-list";
import { SummaryGrid } from "@/app/components/register-page-shell";
import { formatIsoDate, todayIsoDate } from "@/lib/dates";
import {
  formatObligationStatus,
  isObligationActive,
  obligationCoverage,
  type ObligationRecord,
} from "@/lib/types/obligation";
import type { ObligationControlLink } from "@/lib/types/obligation-links";

export function ObligationSummary({
  rows,
  links,
}: {
  rows: ObligationRecord[];
  links: ObligationControlLink[];
}) {
  const coverage = obligationCoverage(rows, links);
  const today = todayIsoDate();
  const upcoming = rows
    .filter(
      (row) =>
        isObligationActive(row) &&
        row.review_date &&
        row.review_date >= today,
    )
    .sort((left, right) =>
      (left.review_date ?? "").localeCompare(right.review_date ?? ""),
    )
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      href: `/obligations/${row.id}/edit`,
      title: row.title,
      meta: formatIsoDate(row.review_date),
    }));
  const overdue = rows.filter(
    (row) =>
      isObligationActive(row) && row.review_date && row.review_date < today,
  ).length;
  const byStatus = (
    ["open", "monitoring", "retired"] as const
  ).map((status) => ({
    name: formatObligationStatus(status),
    value: rows.filter((row) => row.status === status).length,
    filterValue: status,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active"
          value={coverage.active}
          href="/obligations?view=register&status=open"
          linkLabel="Open register"
        />
        <StatCard
          label="Mapped to a control"
          value={coverage.covered}
          href="/obligations?view=register"
          linkLabel="View obligations"
        />
        <StatCard
          label="Coverage gaps"
          value={coverage.uncovered}
          href="/quality"
          linkLabel="Open data quality"
          tone={coverage.uncovered > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Past review date"
          value={overdue}
          href="/obligations?view=register"
          linkLabel="Review the register"
          tone={overdue > 0 ? "alert" : "default"}
        />
      </section>

      <SummaryGrid>
        <ChartCard
          title="By status"
          description="Click a bar to filter the register."
        >
          <TaxonomyBarChart
            data={byStatus}
            hrefBase="/obligations"
            queryParam="status"
          />
        </ChartCard>
        <ChartCard
          title="Upcoming reviews"
          description="Next review dates for active obligations."
        >
          <RecordLinkList
            items={upcoming}
            empty="No upcoming review dates on active obligations."
          />
        </ChartCard>
      </SummaryGrid>
    </div>
  );
}
