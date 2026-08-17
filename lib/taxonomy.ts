import { operatingBand } from "@/lib/risk/ratings";
import type { SeverityBand } from "@/lib/dashboard/analytics";
import type { RiskCategory } from "@/lib/settings/defaults";
import type { Risk } from "@/lib/types/risk";

export const SEVERITY_BAND_RANK: Record<SeverityBand, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

export const UNCATEGORISED_FILTER = "uncategorised";

export function categoryName(
  categories: RiskCategory[],
  categoryId: string | null | undefined,
) {
  if (!categoryId) {
    return "Uncategorised";
  }

  return (
    categories.find((category) => category.id === categoryId)?.name ??
    "Uncategorised"
  );
}

export function categoryAppetite(
  categories: RiskCategory[],
  categoryId: string | null | undefined,
): SeverityBand {
  const band = categories.find((category) => category.id === categoryId)
    ?.appetite_band;
  return band ?? "High";
}

export function isAppetiteBreach(
  risk: Pick<
    Risk,
    "likelihood" | "impact" | "residual_likelihood" | "residual_impact" | "category_id" | "status"
  >,
  categories: RiskCategory[],
) {
  if (risk.status === "closed") {
    return false;
  }

  const operating = operatingBand(risk);
  const appetite = categoryAppetite(categories, risk.category_id);
  return SEVERITY_BAND_RANK[operating] > SEVERITY_BAND_RANK[appetite];
}

export function isActiveRisk(risk: Pick<Risk, "status">) {
  return risk.status !== "closed";
}

export function matchesCategoryFilter(
  categoryId: string | null | undefined,
  filter: string,
) {
  if (!filter) {
    return true;
  }

  if (filter === UNCATEGORISED_FILTER) {
    return !categoryId;
  }

  return categoryId === filter;
}

export function matchesInheritedCategory(
  linkedCategoryIds: Array<string | null | undefined>,
  filter: string,
) {
  if (!filter) {
    return true;
  }

  const ids = linkedCategoryIds.filter((value): value is string => Boolean(value));

  if (filter === UNCATEGORISED_FILTER) {
    return ids.length === 0;
  }

  return ids.includes(filter);
}

export function uniqueCategoryLabels(
  categories: RiskCategory[],
  linkedCategoryIds: Array<string | null | undefined>,
) {
  const names = new Set<string>();

  for (const categoryId of linkedCategoryIds) {
    if (categoryId) {
      names.add(categoryName(categories, categoryId));
    }
  }

  if (names.size === 0) {
    return "Uncategorised";
  }

  return [...names].sort().join(", ");
}

export function indexLinkedCategories(
  rows: Array<{ parentId: string; categoryId: string | null | undefined }>,
) {
  const index: Record<string, string[]> = {};

  for (const row of rows) {
    const bucket = index[row.parentId] ?? [];
    if (row.categoryId && !bucket.includes(row.categoryId)) {
      bucket.push(row.categoryId);
    }
    index[row.parentId] = bucket;
  }

  return index;
}

export function indexLinkedCategoriesFromRisks(
  grouped: Record<string, Array<{ category_id?: string | null }>>,
) {
  return indexLinkedCategories(
    Object.entries(grouped).flatMap(([parentId, risks]) =>
      risks.map((risk) => ({ parentId, categoryId: risk.category_id })),
    ),
  );
}

export function categoryFilterOptions(categories: RiskCategory[]) {
  return [
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
    { value: UNCATEGORISED_FILTER, label: "Uncategorised" },
  ];
}

export function assigneeFilterOptions(
  people: { id: string; name: string }[],
  includeMe = true,
) {
  return [
    ...(includeMe ? [{ value: "me", label: "Assigned to me" }] : []),
    { value: "unassigned", label: "Unassigned" },
    ...people.map((person) => ({ value: person.id, label: person.name })),
  ];
}
