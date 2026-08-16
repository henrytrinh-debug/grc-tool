import { SeverityBandBadge } from "@/app/components/status-badge";
import type { StaleReviewBreakdown, UncontrolledRiskBreakdown } from "@/lib/oversight/metrics";

function BreakdownRow({
  label,
  count,
  alert,
}: {
  label: string;
  count: number;
  alert?: boolean;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      <span
        className={`font-semibold ${
          alert && count > 0
            ? "text-red-700 dark:text-red-400"
            : "text-slate-950 dark:text-slate-50"
        }`}
      >
        {count}
      </span>
    </li>
  );
}

export function StaleReviewsBreakdownList({
  breakdown,
}: {
  breakdown: StaleReviewBreakdown;
}) {
  return (
    <ul className="space-y-2">
      <BreakdownRow label="Never reviewed" count={breakdown.never} alert />
      <BreakdownRow
        label="Reviewed > 365 days ago"
        count={breakdown.over365}
        alert
      />
      <BreakdownRow
        label="Reviewed 180–365 days ago"
        count={breakdown.between180And365}
      />
      <BreakdownRow
        label="Reviewed within 180 days"
        count={breakdown.within180}
      />
    </ul>
  );
}

export function UncontrolledRisksBreakdownList({
  breakdown,
}: {
  breakdown: UncontrolledRiskBreakdown[];
}) {
  const total = breakdown.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Every risk has at least one linked control.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {breakdown
        .filter((row) => row.count > 0)
        .map((row) => (
          <li
            key={row.band}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-800"
          >
            <SeverityBandBadge band={row.band} />
            <span
              className={`font-semibold ${
                row.band === "High" || row.band === "Critical"
                  ? "text-red-700 dark:text-red-400"
                  : "text-slate-950 dark:text-slate-50"
              }`}
            >
              {row.count} uncontrolled
            </span>
          </li>
        ))}
    </ul>
  );
}
