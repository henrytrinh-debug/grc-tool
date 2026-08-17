export const REGISTER_VIEWS = ["summary", "register", "settings"] as const;

export type RegisterView = (typeof REGISTER_VIEWS)[number];

export function parseRegisterView(
  params: URLSearchParams,
  hasListFilters: boolean,
): RegisterView {
  const raw = params.get("view")?.trim();
  if (raw === "summary" || raw === "register" || raw === "settings") {
    return raw;
  }

  if (hasListFilters || params.get("sort")?.trim()) {
    return "register";
  }

  return "summary";
}

export function parseSortParam(params: URLSearchParams) {
  return params.get("sort")?.trim() ?? "";
}

export function nextSortValue(current: string, key: string) {
  if (current === key) {
    return `-${key}`;
  }

  if (current === `-${key}`) {
    return "";
  }

  return key;
}

export function registerTabHref(
  path: string,
  view: RegisterView,
  searchParams: URLSearchParams,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", view);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
