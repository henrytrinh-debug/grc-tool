import { todayIsoDate } from "@/lib/dates";

export type MonthBucket = {
  month: string;
  label: string;
};

function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function lastMonthKeys(count = 12, today = todayIsoDate()): MonthBucket[] {
  const [year, month] = today.split("-").map(Number);
  const keys: MonthBucket[] = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(year, month - 1 - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    keys.push({ month: key, label: monthLabel(key) });
  }

  return keys;
}

export function stackByMonth<T extends string>(
  rows: Array<{ date: string | null | undefined; series: T }>,
  series: T[],
  months = 12,
  today = todayIsoDate(),
): Array<{ month: string; label: string } & Record<T, number>> {
  const buckets = lastMonthKeys(months, today);
  const allowed = new Set(series);
  const counts = new Map<string, Record<T, number>>();

  for (const bucket of buckets) {
    const row = {} as Record<T, number>;
    for (const key of series) {
      row[key] = 0;
    }
    counts.set(bucket.month, row);
  }

  for (const row of rows) {
    if (!row.date || !allowed.has(row.series)) {
      continue;
    }
    const key = monthKey(row.date);
    const bucket = counts.get(key);
    if (!bucket) {
      continue;
    }
    bucket[row.series] += 1;
  }

  return buckets.map((bucket) => ({
    month: bucket.month,
    label: bucket.label,
    ...(counts.get(bucket.month) as Record<T, number>),
  }));
}

export const ISSUE_FLOW_SERIES = [
  { key: "opened", label: "Opened" },
  { key: "closed", label: "Closed" },
] as const;

export const INCIDENT_FLOW_SERIES = [
  { key: "opened", label: "Occurred" },
  { key: "resolved", label: "Resolved" },
] as const;

export const CONTROL_TEST_TREND_SERIES = [
  { key: "effective", label: "Effective" },
  { key: "ineffective", label: "Ineffective" },
] as const;

export function buildIssueFlowTrend(issues: Array<{
  identified_at?: string | null;
  closed_at?: string | null;
}>) {
  return buildOpenedClosedTrend(
    issues.map((row) => ({ date: row.identified_at })),
    issues
      .filter((row) => row.closed_at)
      .map((row) => ({ date: row.closed_at })),
  );
}

export function buildIncidentFlowTrend(incidents: Array<{
  date_occurred?: string | null;
  resolved_at?: string | null;
}>) {
  return buildOpenedClosedTrend(
    incidents.map((row) => ({ date: row.date_occurred })),
    incidents
      .filter((row) => row.resolved_at)
      .map((row) => ({ date: row.resolved_at })),
    "resolved",
  );
}

export function buildControlTestTrend(
  tests: Array<{ tested_at?: string | null; effectiveness?: string | null }>,
) {
  return stackByMonth(
    tests
      .filter(
        (row) =>
          row.effectiveness === "effective" || row.effectiveness === "ineffective",
      )
      .map((row) => ({
        date: row.tested_at,
        series: row.effectiveness as "effective" | "ineffective",
      })),
    ["effective", "ineffective"],
  );
}

export function buildOpenedClosedTrend(
  opened: Array<{ date?: string | null }>,
  closed: Array<{ date?: string | null }>,
  closedKey: "closed" | "resolved" = "closed",
) {
  return stackByMonth(
    [
      ...opened.map((row) => ({ date: row.date, series: "opened" as const })),
      ...closed.map((row) => ({ date: row.date, series: closedKey })),
    ],
    ["opened", closedKey],
  );
}

export type FlowWindowTotals = {
  opened: number;
  closed: number;
  net: number;
};

/** Stock/flow caption: inflows vs outflows across the already-bucketed window. */
export function summariseFlowWindow(
  rows: Array<{ opened: number; closed?: number; resolved?: number }>,
  closedKey: "closed" | "resolved" = "closed",
): FlowWindowTotals {
  const totals = rows.reduce<{ opened: number; closed: number }>(
    (acc, row) => {
      const closed = Number(row[closedKey] ?? 0);
      return {
        opened: acc.opened + row.opened,
        closed: acc.closed + closed,
      };
    },
    { opened: 0, closed: 0 },
  );

  return { ...totals, net: totals.opened - totals.closed };
}

export function formatFlowWindowHint(totals: FlowWindowTotals, closedLabel: string) {
  const netLabel =
    totals.net === 0
      ? "net flat"
      : totals.net > 0
        ? `net +${totals.net}`
        : `net ${totals.net}`;
  return `Last 12 months: ${totals.opened} in, ${totals.closed} ${closedLabel} (${netLabel}).`;
}
