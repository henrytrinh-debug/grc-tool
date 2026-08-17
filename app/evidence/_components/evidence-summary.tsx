import { ChartCard } from "@/app/components/dashboard/chart-card";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { TaxonomyBarChart } from "@/app/components/dashboard/taxonomy-bar-chart";
import { RecordLinkList } from "@/app/components/record-link-list";
import { SummaryGrid } from "@/app/components/register-page-shell";
import { formatIsoDate } from "@/lib/dates";
import {
  EVIDENCE_ENTITY_OPTIONS,
  formatEvidenceEntityType,
  isEvidenceExpired,
  type EvidenceRecord,
} from "@/lib/types/evidence";

export function EvidenceSummary({ rows }: { rows: EvidenceRecord[] }) {
  const expired = rows.filter((row) => isEvidenceExpired(row));
  const withFile = rows.filter((row) => row.storage_path).length;
  const byType = EVIDENCE_ENTITY_OPTIONS.map((option) => ({
    name: option.label,
    value: rows.filter((row) => row.entity_type === option.value).length,
    filterValue: option.value,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Evidence records"
          value={rows.length}
          href="/evidence?view=register"
          linkLabel="Open register"
        />
        <StatCard
          label="With a file"
          value={withFile}
          hint="Metadata-only records are still valid"
        />
        <StatCard
          label="Past retention"
          value={expired.length}
          href="/evidence?view=register&expired=true"
          linkLabel="View expired"
          tone={expired.length > 0 ? "alert" : "default"}
        />
      </section>

      <SummaryGrid>
        <ChartCard
          title="By linked type"
          description="Click a bar to filter the register."
        >
          <TaxonomyBarChart
            data={byType}
            hrefBase="/evidence"
            queryParam="entityType"
          />
        </ChartCard>
        <ChartCard
          title="Past retention"
          description="Records whose retention date has passed."
        >
          <RecordLinkList
            items={expired.slice(0, 8).map((row) => ({
              id: row.id,
              href: `/evidence/${row.id}/edit`,
              title: row.title,
              meta: `${formatEvidenceEntityType(row.entity_type)} · ${formatIsoDate(row.retention_date)}`,
            }))}
            empty="No evidence is past its retention date."
            moreHref={expired.length > 8 ? "/evidence?view=register&expired=true" : undefined}
            moreLabel={`View all (${expired.length})`}
          />
        </ChartCard>
      </SummaryGrid>
    </div>
  );
}
