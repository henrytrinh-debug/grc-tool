"use client";

import { useState } from "react";
import {
  inputClassName,
  primaryButtonClassName,
} from "@/app/components/ui";
import {
  formatCommentTimestamp,
  type IssueComment,
} from "@/lib/types/issue-comment";

type ActivityTrailPanelProps = {
  comments: IssueComment[];
  saving: boolean;
  onAddComment: (body: string) => Promise<boolean>;
};

export function ActivityTrailPanel({
  comments,
  saving,
  onAddComment,
}: ActivityTrailPanelProps) {
  const [body, setBody] = useState("");

  async function handleSubmit() {
    if (!body.trim()) {
      return;
    }

    const added = await onAddComment(body.trim());

    if (added) {
      setBody("");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Activity
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Status changes are recorded automatically alongside your notes.
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a note to the audit trail..."
          className={`w-full ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !body.trim()}
          className={primaryButtonClassName}
        >
          {saving ? "Adding..." : "Add Note"}
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No activity recorded yet.
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
