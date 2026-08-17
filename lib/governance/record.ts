import { getSupabaseClient } from "@/lib/supabase/client";
import type { GovernanceEventDraft } from "@/lib/governance/events";

export async function insertGovernanceEvents(input: {
  table: "risk_events" | "incident_events";
  parentColumn: "risk_id" | "incident_id";
  parentId: string;
  drafts: GovernanceEventDraft[];
  ownerId: string;
  ownerEmail: string | null | undefined;
  actorId: string;
  actorEmail: string | null | undefined;
}) {
  if (input.drafts.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(input.table).insert(
    input.drafts.map((draft) => ({
      [input.parentColumn]: input.parentId,
      event_type: draft.event_type,
      field: draft.field,
      previous_value: draft.previous_value,
      next_value: draft.next_value,
      actor_id: input.actorId,
      actor_email: input.actorEmail ?? null,
      owner_id: input.ownerId,
      owner_email: input.ownerEmail ?? null,
    })),
  );

  if (error) {
    throw error;
  }
}

/** Inserts event drafts. Returns a warning when history fails; the parent write already succeeded. */
export async function insertGovernanceEventsOrWarn(
  input: Parameters<typeof insertGovernanceEvents>[0],
): Promise<string | null> {
  try {
    await insertGovernanceEvents(input);
    return null;
  } catch (err) {
    return err instanceof Error
      ? `Saved, but the change history could not be recorded: ${err.message}`
      : "Saved, but the change history could not be recorded.";
  }
}
