import { ChartCard } from "@/app/components/dashboard/chart-card";
import { RiskHeatMap } from "@/app/components/dashboard/risk-heat-map";
import { RiskSeverityBarChart } from "@/app/components/dashboard/risk-severity-bar-chart";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { TaxonomyBarChart } from "@/app/components/dashboard/taxonomy-bar-chart";
import { LineTimeChart } from "@/app/components/dashboard/time-charts";
import { SummaryGrid } from "@/app/components/register-page-shell";
import { stackByMonth } from "@/lib/charts/time-series";
import {
  buildSeverityBandCounts,
  buildTaxonomyRiskCounts,
  buildTreatmentCounts,
} from "@/lib/dashboard/analytics";
import { highCriticalRisks } from "@/lib/metrics/kpis";
import { storedResidual } from "@/lib/risk/ratings";
import type { RiskCategory } from "@/lib/settings/defaults";
import { isActiveRisk } from "@/lib/taxonomy";
import { isReviewDue } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

export function RiskSummary({
  risks,
  categories,
  lastReviewedByRisk,
  linkedControlCounts,
  reviews,
  schemaReady,
  residualReady,
}: {
  risks: Risk[];
  categories: RiskCategory[];
  lastReviewedByRisk: Record<string, string>;
  linkedControlCounts: Record<string, number>;
  reviews: Array<{ reviewed_at: string }>;
  schemaReady: boolean;
  residualReady: boolean;
}) {
  const active = risks.filter(isActiveRisk);
  const highCritical = highCriticalRisks(active);
  const due = active.filter((risk) =>
    isReviewDue(
      lastReviewedByRisk[risk.id] ?? null,
      risk.likelihood,
      risk.impact,
    ),
  ).length;
  const uncontrolled = active.filter(
    (risk) => (linkedControlCounts[risk.id] ?? 0) === 0,
  ).length;
  const unassessedResidual = residualReady
    ? active.filter((risk) => !storedResidual(risk)).length
    : 0;
  const reviewTrend = stackByMonth(
    reviews.map((review) => ({ date: review.reviewed_at, series: "reviews" })),
    ["reviews"],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active risks"
          value={active.length}
          href="/risks?view=register&status=open"
          linkLabel="Open register"
        />
        <StatCard
          label="High / Critical"
          value={highCritical.length}
          href="/risks?view=register&severity=High,Critical"
          linkLabel="Filter High or Critical"
          tone={highCritical.length > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Uncontrolled"
          value={uncontrolled}
          href="/risks?view=register&uncontrolled=true"
          linkLabel="View uncontrolled"
          tone={uncontrolled > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Due for review"
          value={due}
          href="/risks?view=register&reviewRecency=due"
          linkLabel="View due reviews"
          tone={due > 0 ? "alert" : "default"}
        />
        {residualReady ? (
          <StatCard
            label="Residual not assessed"
            value={unassessedResidual}
            href="/risks?view=register&residualUnassessed=true"
            linkLabel="View unassessed"
            tone={unassessedResidual > 0 ? "alert" : "default"}
          />
        ) : null}
      </section>

      <SummaryGrid>
        <ChartCard
          title="Risk heat map"
          description="Toggle inherent vs residual. Click a cell to open the register. Closed risks are excluded."
        >
          <div className="mt-2">
            <RiskHeatMap risks={active} residualReady={residualReady} />
          </div>
        </ChartCard>
        <ChartCard
          title="Risks by score"
          description="Operating score bands (residual if assessed, otherwise inherent). Matches High/Critical and the register Score filter."
        >
          <RiskSeverityBarChart data={buildSeverityBandCounts(active)} />
        </ChartCard>
        {schemaReady ? (
          <ChartCard
            title="Risks by taxonomy"
            description="Click a bar to filter the register by category."
          >
            <TaxonomyBarChart data={buildTaxonomyRiskCounts(active, categories)} />
          </ChartCard>
        ) : null}
        {schemaReady ? (
          <ChartCard
            title="Treatment mix"
            description="How active risks are being treated."
          >
            <TaxonomyBarChart
              data={buildTreatmentCounts(active)}
              queryParam="treatment"
            />
          </ChartCard>
        ) : null}
        <ChartCard
          title="Reviews over time"
          description="RCSA reviews completed in each of the last 12 months."
        >
          <LineTimeChart
            data={reviewTrend}
            series={[{ key: "reviews", label: "Reviews" }]}
            empty="No reviews recorded in the last 12 months."
          />
        </ChartCard>
      </SummaryGrid>
    </div>
  );
}
