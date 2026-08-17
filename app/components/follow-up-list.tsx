"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FollowUpStatusBadge } from "@/app/components/status-badge";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { isProbeMissing } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatIsoDate } from "@/lib/dates";
import { formatPersonName, type OrgPerson } from "@/lib/types/person";
import {
  entityHref,
  followUpHref,
  followUpStatusPatch,
  formatFollowUpStatus,
  formatFollowUpTrigger,
  isFollowUpOpen,
  type FollowUp,
  type FollowUpEntityType,
  type FollowUpStatus,
} from "@/lib/types/follow-up";

type FollowUpListProps = {
  entityType?: FollowUpEntityType;
  entityId?: string;
  owner: { id: string; email: string } | null;
  enabled: boolean;
  people: OrgPerson[];
  focusId?: string;
  title?: string;
  description?: string;
};

export function FollowUpList({
  entityType,
  entityId,
  owner,
  enabled,
  people,
  focusId,
  title = "Follow-ups",
  description = "Challenge loops raised when incidents, issues, tests, or rating changes need a second look.",
}: FollowUpListProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !owner) {
      setFollowUps([]);
      return;
    }

    let query = getSupabaseClient()
      .from("follow_ups")
      .select("*")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false });

    if (entityType && entityId) {
      query = query.eq("entity_type", entityType).eq("entity_id", entityId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      if (isProbeMissing(fetchError)) {
        setFollowUps([]);
        return;
      }
      throw fetchError;
    }

    setFollowUps((data ?? []) as FollowUp[]);
  }, [enabled, entityId, entityType, owner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async follow-up load
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load follow-ups");
    });
  }, [refresh]);

  async function setStatus(followUp: FollowUp, status: FollowUpStatus) {
    if (!owner) {
      return;
    }

    setUpdatingId(followUp.id);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("follow_ups")
        .update(followUpStatusPatch(status))
        .eq("id", followUp.id)
        .eq("owner_id", owner.id);

      if (updateError) {
        throw updateError;
      }

      if (owner.email) {
        await supabase.from("entity_comments").insert({
          entity_type: "follow_up",
          entity_id: followUp.id,
          body: `Follow-up marked ${formatFollowUpStatus(status)}.`,
          kind: "status_change",
          owner_id: owner.id,
          owner_email: owner.email,
        });
      }

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update follow-up");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!enabled) {
    return null;
  }

  const rows =
    entityType && entityId
      ? followUps.filter((item) => isFollowUpOpen(item.status) || item.id === focusId)
      : followUps;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {entityType
            ? "No follow-ups on this record."
            : "No follow-ups yet. Linking an incident or issue, recording an ineffective test, or changing a rating will raise one."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((followUp) => {
            const focused = focusId === followUp.id;
            return (
              <li
                key={followUp.id}
                id={`follow-up-${followUp.id}`}
                className={`rounded-lg border px-4 py-3 ${
                  focused
                    ? "border-accent bg-accent-muted/40"
                    : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={
                        entityType
                          ? followUpHref(followUp)
                          : entityHref(followUp.entity_type, followUp.entity_id)
                      }
                      className="font-medium text-slate-950 hover:underline dark:text-slate-50"
                    >
                      {followUp.title}
                    </Link>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {followUp.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFollowUpTrigger(followUp.trigger_type)}
                      {followUp.due_date
                        ? ` · due ${formatIsoDate(followUp.due_date)}`
                        : ""}
                      {` · ${formatPersonName(people, followUp.assignee_id)}`}
                      {followUp.approver_id
                        ? ` · approver ${formatPersonName(people, followUp.approver_id)}`
                        : ""}
                    </p>
                  </div>
                  <FollowUpStatusBadge status={followUp.status} />
                </div>
                {isFollowUpOpen(followUp.status) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {followUp.status === "open" ? (
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        disabled={updatingId === followUp.id}
                        onClick={() => void setStatus(followUp, "in_progress")}
                      >
                        Start
                      </button>
                    ) : null}
                    {followUp.status === "pending_approval" ? (
                      <>
                        <button
                          type="button"
                          className={primaryButtonClassName}
                          disabled={updatingId === followUp.id}
                          onClick={() => void setStatus(followUp, "done")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={updatingId === followUp.id}
                          onClick={() => void setStatus(followUp, "dismissed")}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={primaryButtonClassName}
                        disabled={updatingId === followUp.id}
                        onClick={() => void setStatus(followUp, "done")}
                      >
                        Mark done
                      </button>
                    )}
                    {followUp.status !== "pending_approval" ? (
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        disabled={updatingId === followUp.id}
                        onClick={() => void setStatus(followUp, "dismissed")}
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
