import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Inserts a row stamped with the signed-in user as owner, which every table in
 * this app requires for its row-level security policy.
 */
export async function insertOwnedRecord(
  table: string,
  payload: Record<string, unknown>,
) {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to do that");
  }

  if (!user.email) {
    throw new Error("User email not available");
  }

  const { error } = await supabase.from(table).insert({
    ...payload,
    owner_id: user.id,
    owner_email: user.email,
  });

  if (error) {
    throw error;
  }
}
