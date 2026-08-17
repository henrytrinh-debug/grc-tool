"use client";

import { useCallback, useEffect, useState } from "react";
import { inputClassName, primaryButtonClassName } from "@/app/components/ui";
import { isProbeMissing } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  formatCommentTimestamp,
  type CommentEntityType,
  type EntityComment,
} from "@/lib/types/entity-comment";

type EntityCommentPanelProps = {
  entityType: CommentEntityType;
  entityId: string;
  owner: { id: string; email: string } | null;
  enabled: boolean;
};

export function EntityCommentPanel({
  entityType,
  entityId,
  owner,
  enabled,
}: EntityCommentPanelProps) {
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !owner) {
      setComments([]);
      return;
    }

    const { data, error: fetchError } = await getSupabaseClient()
      .from("entity_comments")
      .select("*")
      .eq("owner_id", owner.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      if (isProbeMissing(fetchError)) {
        setComments([]);
        return;
      }
      throw fetchError;
    }

    setComments((data ?? []) as EntityComment[]);
  }, [enabled, entityId, entityType, owner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async comment load
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    });
  }, [refresh]);

  async function handleSubmit() {
    if (!owner?.email || !body.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: insertError } = await getSupabaseClient()
        .from("entity_comments")
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          body: body.trim(),
          kind: "comment",
          owner_id: owner.id,
          owner_email: owner.email,
        });

      if (insertError) {
        throw insertError;
      }

      setBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Comments
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Notes stay with this record. Status changes from follow-ups appear in
          Feedback → Audit trail.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : null}

      <div className="space-y-2">
        <textarea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment..."
          className={`w-full ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !body.trim() || !owner}
          className={primaryButtonClassName}
        >
          {saving ? "Adding..." : "Add comment"}
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No comments yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{formatCommentTimestamp(comment.created_at)}</span>
                {comment.owner_email && <span>· {comment.owner_email}</span>}
                {comment.kind === "status_change" && (
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    System
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-950 dark:text-slate-50">
                {comment.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
