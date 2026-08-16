import Link from "next/link";
import { SeverityBandBadge } from "@/app/components/status-badge";
import type { StaleReviewBreakdown, UncontrolledRiskBreakdown } from "@/lib/oversight/metrics";

function BreakdownRow({
  label,
  count,
  alert,
  href,
}: {
  label: string;
  count: number;
  alert?: boolean;
  href?: string;
}) {
  const content = (
    <>
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
    </>
  );

  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm transition-colors hover:border-teal-300 dark:border-slate-800 dark:hover:border-teal-700"
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
      {content}
    </li>
  );
}

export function StaleReviewsBreakdownList({
  breakdown,
  dueCount,
}: {
  breakdown: StaleReviewBreakdown;
  dueCount?: number;
}) {
  return (
    <ul className="space-y-2">
      {dueCount !== undefined && (
        <BreakdownRow
          label="Due for review (by cadence)"
          count={dueCount}
          alert
          href="/risks?reviewRecency=due"
        />
      )}
      <BreakdownRow
        label="Never reviewed"
        count={breakdown.never}
        alert
        href="/risks?reviewRecency=never"
      />
      <BreakdownRow
        label="Reviewed > 365 days ago"
        count={breakdown.over365}
        alert
        href="/risks?reviewRecency=over365"
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
          <li key={row.band}>
            <Link
              href={`/risks?uncontrolled=true&severity=${row.band}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm transition-colors hover:border-teal-300 dark:border-slate-800 dark:hover:border-teal-700"
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
            </Link>
          </li>
        ))}
    </ul>
  );
}
