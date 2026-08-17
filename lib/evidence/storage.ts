import { getSupabaseClient } from "@/lib/supabase/client";
import { EVIDENCE_BUCKET, evidenceObjectPath } from "@/lib/types/evidence";

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadEvidenceObject(
  ownerId: string,
  evidenceId: string,
  file: File,
) {
  if (file.size > MAX_BYTES) {
    throw new Error("Files must be 10 MB or smaller.");
  }

  const path = evidenceObjectPath(ownerId, evidenceId, file.name);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) {
    throw error;
  }

  return { path, filename: file.name };
}

export async function removeEvidenceObject(path: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}

export async function signedEvidenceUrl(path: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
