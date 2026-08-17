import { isProbeMissing } from "@/lib/supabase/owned";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultFollowUpDueDate,
  isFollowUpOpen,
  type FollowUp,
  type FollowUpEntityType,
  type FollowUpTrigger,
} from "@/lib/types/follow-up";

export type FollowUpDraft = {
  title: string;
  description: string;
  entityType: FollowUpEntityType;
  entityId: string;
  trigger: FollowUpTrigger;
  assigneeId?: string | null;
  approverId?: string | null;
  status?: FollowUp["status"];
  dueDate?: string | null;
  sourceIncidentId?: string | null;
  sourceIssueId?: string | null;
};

/**
 * Creates a follow-up unless an open one already exists for the same
 * owner + entity + trigger. Missing-table errors are ignored so pages work
 * before 011_feedback.sql is applied.
 */
export async function ensureFollowUp(
  supabase: SupabaseClient,
  owner: { id: string; email: string },
  draft: FollowUpDraft,
): Promise<FollowUp | null> {
  const existing = await supabase
    .from("follow_ups")
    .select("*")
    .eq("owner_id", owner.id)
    .eq("entity_type", draft.entityType)
    .eq("entity_id", draft.entityId)
    .eq("trigger_type", draft.trigger)
    .in("status", ["open", "in_progress", "pending_approval"])
    .limit(1);

  if (existing.error) {
    if (isProbeMissing(existing.error)) {
      return null;
    }
    throw existing.error;
  }

  const current = ((existing.data ?? []) as FollowUp[])[0];
  if (current && isFollowUpOpen(current.status)) {
    return current;
  }

  const inserted = await supabase
    .from("follow_ups")
    .insert({
      title: draft.title,
      description: draft.description,
      entity_type: draft.entityType,
      entity_id: draft.entityId,
      trigger_type: draft.trigger,
      status: draft.status ?? (draft.approverId ? "pending_approval" : "open"),
      assignee_id: draft.assigneeId ?? null,
      approver_id: draft.approverId ?? null,
      due_date: draft.dueDate ?? defaultFollowUpDueDate(),
      source_incident_id: draft.sourceIncidentId ?? null,
      source_issue_id: draft.sourceIssueId ?? null,
      owner_id: owner.id,
      owner_email: owner.email,
    })
    .select("*")
    .single();

  if (inserted.error) {
    if (isProbeMissing(inserted.error) || inserted.error.code === "23505") {
      return current ?? null;
    }
    throw inserted.error;
  }

  return inserted.data as FollowUp;
}

export async function followUpAfterLink(
  supabase: SupabaseClient,
  owner: { id: string; email: string },
  input: {
    table: string;
    parentColumn: string;
    parentId: string;
    childId: string;
  },
) {
  const { table, parentColumn, parentId, childId } = input;

  if (table === "incident_controls") {
    const incidentId = parentColumn === "incident_id" ? parentId : childId;
    const controlId = parentColumn === "control_id" ? parentId : childId;
    return ensureFollowUp(supabase, owner, {
      title: "Retest control after a linked incident",
      description:
        "An incident was mapped to this control. Confirm design/operating effectiveness still holds, then retest.",
      entityType: "control",
      entityId: controlId,
      trigger: "incident_on_control",
      sourceIncidentId: incidentId,
    });
  }

  if (table === "issue_controls") {
    const issueId = parentColumn === "issue_id" ? parentId : childId;
    const controlId = parentColumn === "control_id" ? parentId : childId;
    return ensureFollowUp(supabase, owner, {
      title: "Reassess control after a linked finding",
      description:
        "An issue was mapped to this control. Decide whether the control needs redesign, retesting, or residual impact on linked risks.",
      entityType: "control",
      entityId: controlId,
      trigger: "issue_on_control",
      sourceIssueId: issueId,
    });
  }

  if (table === "incident_risks") {
    const incidentId = parentColumn === "incident_id" ? parentId : childId;
    const riskId = parentColumn === "risk_id" ? parentId : childId;
    return ensureFollowUp(supabase, owner, {
      title: "Reassess residual after a linked incident",
      description:
        "An incident was mapped to this risk. Confirm inherent still holds and whether residual credit is still justified.",
      entityType: "risk",
      entityId: riskId,
      trigger: "incident_on_risk",
      sourceIncidentId: incidentId,
    });
  }

  if (table === "issue_risks") {
    const issueId = parentColumn === "issue_id" ? parentId : childId;
    const riskId = parentColumn === "risk_id" ? parentId : childId;
    return ensureFollowUp(supabase, owner, {
      title: "Reassess residual after a linked finding",
      description:
        "An issue was mapped to this risk. Confirm treatment and residual still match how the risk is running.",
      entityType: "risk",
      entityId: riskId,
      trigger: "issue_on_risk",
      sourceIssueId: issueId,
    });
  }

  return null;
}
