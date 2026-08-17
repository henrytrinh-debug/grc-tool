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

export const OPERATING_TREND_SERIES = [
  { key: "incidents", label: "Incidents" },
  { key: "issues", label: "Issues identified" },
  { key: "tests", label: "Control tests" },
] as const;

export function buildOperatingTrend(input: {
  incidents: Array<{ date_occurred?: string | null }>;
  issues: Array<{ identified_at?: string | null }>;
  tests: Array<{ tested_at?: string | null }>;
}) {
  return stackByMonth(
    [
      ...input.incidents.map((row) => ({
        date: row.date_occurred,
        series: "incidents" as const,
      })),
      ...input.issues.map((row) => ({
        date: row.identified_at,
        series: "issues" as const,
      })),
      ...input.tests.map((row) => ({
        date: row.tested_at,
        series: "tests" as const,
      })),
    ],
    ["incidents", "issues", "tests"],
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
