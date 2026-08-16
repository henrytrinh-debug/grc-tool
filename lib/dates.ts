const DAY_MS = 1000 * 60 * 60 * 24;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as `YYYY-MM-DD` (not UTC, which can be yesterday). */
export function todayIsoDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;

  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * Parse a date-only column (`YYYY-MM-DD`) as local midnight so list labels
 * don't shift a day in US timezones. Timestamps keep native parsing.
 */
export function parseIsoDate(value: string) {
  if (DATE_ONLY.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  return new Date(value);
}

export function formatIsoDate(
  value: string | null | undefined,
  empty = "—",
) {
  if (!value) {
    return empty;
  }

  const date = parseIsoDate(value);

  if (Number.isNaN(date.getTime())) {
    return empty;
  }

  return date.toLocaleDateString();
}

/** Positive when `laterMs` is after `earlierMs`. */
export function daysBetweenMs(laterMs: number, earlierMs: number) {
  return (laterMs - earlierMs) / DAY_MS;
}

export function daysSinceIso(value: string) {
  return daysBetweenMs(Date.now(), parseIsoDate(value).getTime());
}

export function addDaysToIsoDate(isoDate: string, days: number) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}
