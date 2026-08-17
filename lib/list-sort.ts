export function applySort<T>(
  rows: T[],
  sort: string,
  getters: Record<string, (row: T) => string | number | null | undefined>,
): T[] {
  if (!sort) {
    return rows;
  }

  const descending = sort.startsWith("-");
  const key = descending ? sort.slice(1) : sort;
  const get = getters[key];
  if (!get) {
    return rows;
  }

  const direction = descending ? -1 : 1;

  return [...rows].sort((left, right) => {
    const a = get(left);
    const b = get(right);

    if (a == null && b == null) {
      return 0;
    }
    if (a == null) {
      return 1;
    }
    if (b == null) {
      return -1;
    }

    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * direction;
    }

    return String(a).localeCompare(String(b)) * direction;
  });
}
