import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type QueryResult<T> = {
  data: T[] | T | null;
  error: PostgrestError | null;
};

export function throwIfQueryError<T>(result: QueryResult<T>) {
  if (result.error) {
    throw result.error;
  }

  return result;
}

export function throwIfAnyQueryError(results: { error: PostgrestError | null }[]) {
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw failed.error;
  }
}

/** Owner-scoped table read used by dashboards and list pages. */
export async function fetchOwnedTable<T>(
  supabase: SupabaseClient,
  table: string,
  ownerId: string,
  options?: {
    columns?: string;
    order?: string;
    ascending?: boolean;
  },
) {
  let query = supabase
    .from(table)
    .select(options?.columns ?? "*")
    .eq("owner_id", ownerId);

  if (options?.order) {
    query = query.order(options.order, {
      ascending: options.ascending ?? false,
    });
  }

  const result = await query;
  throwIfQueryError(result);
  return (result.data ?? []) as T[];
}
