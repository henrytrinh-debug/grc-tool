/**
 * Supabase returns an embedded relation as either an object or a single-element
 * array depending on how the relationship is inferred.
 */
export function unwrapJoinRelation<T>(
  relation: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

/**
 * Groups join-table rows by one side of the relationship, mapping each row and
 * its embedded relation into a display shape. Rows whose relation failed to
 * load are skipped.
 */
export function groupJoinRows<TRow, TRelated, TLinked>(
  rows: TRow[],
  groupBy: (row: TRow) => string,
  relationOf: (row: TRow) => TRelated | TRelated[] | null | undefined,
  map: (row: TRow, related: TRelated) => TLinked,
): Record<string, TLinked[]> {
  const grouped: Record<string, TLinked[]> = {};

  for (const row of rows) {
    const related = unwrapJoinRelation(relationOf(row));

    if (!related) {
      continue;
    }

    const key = groupBy(row);
    const bucket = grouped[key] ?? [];
    bucket.push(map(row, related));
    grouped[key] = bucket;
  }

  return grouped;
}

export function countGroupedLinks(grouped: Record<string, unknown[]>) {
  const counts: Record<string, number> = {};

  for (const [key, links] of Object.entries(grouped)) {
    counts[key] = links.length;
  }

  return counts;
}

export function countByKey<T>(rows: T[], keyOf: (row: T) => string) {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const key = keyOf(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}
