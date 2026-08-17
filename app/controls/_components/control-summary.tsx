import { ChartCard } from "@/app/components/dashboard/chart-card";
import { ControlsEffectivenessDonut } from "@/app/components/dashboard/donut-charts";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { StackedTimeChart } from "@/app/components/dashboard/time-charts";
import {
  ControlKeySplitDonut,
  TestingCoverageDonut,
} from "@/app/components/oversight/oversight-donuts";
import { SummaryGrid } from "@/app/components/register-page-shell";
import { stackByMonth } from "@/lib/charts/time-series";
import { buildControlEffectivenessCounts } from "@/lib/dashboard/analytics";
import {
  buildControlKeyStats,
  buildTestingCoverage,
  toControlKeySplitChartCounts,
  toTestingCoverageChartCounts,
} from "@/lib/oversight/metrics";
import type { Control } from "@/lib/types/control";

export function ControlSummary({
  controls,
  linkedRiskCounts,
  tests,
}: {
  controls: Control[];
  linkedRiskCounts: Record<string, number>;
  tests: Array<{ tested_at: string; effectiveness: string }>;
}) {
  const keyStats = buildControlKeyStats(controls);
  const coverage = buildTestingCoverage(controls);
  const keyCoverage = buildTestingCoverage(
    controls.filter((control) => control.is_key),
  );
  const unmapped = controls.filter(
    (control) => (linkedRiskCounts[control.id] ?? 0) === 0,
  ).length;
  const testTrend = stackByMonth(
    tests.map((test) => ({
      date: test.tested_at,
      series: test.effectiveness === "effective" ? "effective" : "ineffective",
    })),
    ["effective", "ineffective"],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Controls"
          value={controls.length}
          href="/controls?view=register"
          linkLabel="Open register"
        />
        <StatCard
          label="Key overdue"
          value={keyCoverage.overdue}
          href="/controls?view=register&isKey=true&testingStatus=Overdue"
          linkLabel="View overdue key controls"
          tone={keyCoverage.overdue > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Never tested"
          value={coverage.neverTested}
          href="/controls?view=register&testingStatus=Never Tested"
          linkLabel="View never tested"
        />
        <StatCard
          label="Unmapped"
          value={unmapped}
          href="/controls?view=register&unmapped=true"
          linkLabel="View unmapped"
          tone={unmapped > 0 ? "alert" : "default"}
        />
      </section>

      <SummaryGrid>
        <ChartCard
          title="Effectiveness"
          description="Click a slice to filter the register."
        >
          <ControlsEffectivenessDonut
            data={buildControlEffectivenessCounts(controls)}
          />
        </ChartCard>
        <ChartCard
          title="Testing coverage"
          description="Never tested, current, and overdue against the configured cadence."
        >
          <TestingCoverageDonut data={toTestingCoverageChartCounts(coverage)} />
        </ChartCard>
        <ChartCard
          title="Key vs non-key"
          description="Click a slice to filter the register."
        >
          <ControlKeySplitDonut data={toControlKeySplitChartCounts(keyStats)} />
        </ChartCard>
        <ChartCard
          title="Tests over time"
          description="Recorded test results in the last 12 months, stacked by outcome."
        >
          <StackedTimeChart
            data={testTrend}
            series={[
              { key: "effective", label: "Effective" },
              { key: "ineffective", label: "Ineffective" },
            ]}
            empty="No control tests recorded in the last 12 months."
          />
        </ChartCard>
      </SummaryGrid>
    </div>
  );
}
