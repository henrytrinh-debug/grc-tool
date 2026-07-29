"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps list-page filters in the URL so views are shareable and the dashboard
 * can deep-link into a filtered list.
 */
export function useListFilters<TFilters>(
  basePath: string,
  parse: (params: URLSearchParams) => TFilters,
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parse(searchParams), [parse, searchParams]);

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();
      router.replace(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.replace(basePath);
  }, [basePath, router]);

  return { filters, updateFilters, clearFilters };
}
