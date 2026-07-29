"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LinkedEntitiesPanel } from "@/app/components/linked-entities-panel";
import {
  buildControlRows,
  buildRiskRows,
  CONTROL_COLUMNS,
  RISK_COLUMNS,
} from "@/app/components/linked-entity-rows";
import {
  BackLink,
  ErrorBanner,
  PageLoading,
} from "@/app/components/page-parts";
import {
  IssueSeverityBadge,
  OverdueBadge,
} from "@/app/components/status-badge";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { useEntityLinks } from "@/lib/hooks/use-entity-links";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  describeTransition,
  getTransitionBlockers,
  getTransitionPatch,
} from "@/lib/issues/workflow";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import {
  formatDueDateLabel,
  formatIssueSeverity,
  isIssueOverdue,
  toIssueFormPayload,
  type Issue,
  type IssueStatus,
  type NewIssue,
} from "@/lib/types/issue";
import type {
  IssueAction,
  IssueActionStatus,
  NewIssueAction,
} from "@/lib/types/issue-action";
import type { IssueComment } from "@/lib/types/issue-comment";
import {
  groupControlsByIssue,
  groupRisksByIssue,
  ISSUE_CONTROL_SELECT,
  ISSUE_RISK_SELECT,
  type IssueControlRow,
  type IssueRiskRow,
} from "@/lib/types/issue-links";
import type { LinkedControl, LinkedRisk } from "@/lib/types/linked-entities";
import type { Risk } from "@/lib/types/risk";
import { ActionPlanPanel } from "../../_components/action-plan-panel";
import { ActivityTrailPanel } from "../../_components/activity-trail-panel";
import { IssueFormFields } from "../../_components/issue-form-fields";
import { WorkflowPanel } from "../../_components/workflow-panel";

function toForm(issue: Issue): NewIssue {
  return {
    title: issue.title,
    description: issue.description,
    source: issue.source,
    severity: issue.severity,
    status: issue.status,
    identified_at: issue.identified_at?.slice(0, 10) ?? "",
    due_date: issue.due_date?.slice(0, 10) ?? "",
    root_cause: issue.root_cause,
    remediation_plan: issue.remediation_plan,
    closure_notes: issue.closure_notes,
  };
}

export default function EditIssuePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const issueId = params.id;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [form, setForm] = useState<NewIssue | null>(null);
  const [actions, setActions] = useState<IssueAction[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [userControls, setUserControls] = useState<Control[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transitioningTo, setTransitioningTo] = useState<IssueStatus | null>(
    null,
  );
  const [savingAction, setSavingAction] = useState(false);
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("issue_actions")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    setActions((data ?? []) as IssueAction[]);
  }, [issueId]);

  const fetchComments = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("issue_comments")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    setComments((data ?? []) as IssueComment[]);
  }, [issueId]);

  const {
    linked: linkedRisks,
    refresh: refreshRiskLinks,
    panelProps: riskPanelProps,
  } = useEntityLinks<IssueRiskRow, LinkedRisk>({
    table: "issue_risks",
    select: ISSUE_RISK_SELECT,
    parentColumn: "issue_id",
    parentId: issueId,
    childColumn: "risk_id",
    parse: (rows) => groupRisksByIssue(rows)[issueId] ?? [],
    label: "risk",
    onError: setError,
  });

  const {
    linked: linkedControls,
    refresh: refreshControlLinks,
    panelProps: controlPanelProps,
  } = useEntityLinks<IssueControlRow, LinkedControl>({
    table: "issue_controls",
    select: ISSUE_CONTROL_SELECT,
    parentColumn: "issue_id",
    parentId: issueId,
    childColumn: "control_id",
    parse: (rows) => groupControlsByIssue(rows)[issueId] ?? [],
    label: "control",
    onError: setError,
  });

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("issues")
          .select("*")
          .eq("id", issueId)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          router.replace("/issues");
          return;
        }

        const loadedIssue = data as Issue;
        setIssue(loadedIssue);
        setForm(toForm(loadedIssue));

        const [risksResult, controlsResult] = await Promise.all([
          supabase
            .from("risks")
            .select("*")
            .eq("owner_id", ownerId)
            .order("title", { ascending: true }),
          supabase
            .from("controls")
            .select("*")
            .eq("owner_id", ownerId)
            .order("title", { ascending: true }),
        ]);

        if (risksResult.error) {
          throw risksResult.error;
        }

        if (controlsResult.error) {
          throw controlsResult.error;
        }

        setUserRisks((risksResult.data ?? []) as Risk[]);
        setUserControls((controlsResult.data ?? []) as Control[]);

        await Promise.all([
          fetchActions(),
          fetchComments(),
          refreshRiskLinks(ownerId),
          refreshControlLinks(ownerId),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load issue");
      } finally {
        setLoading(false);
      }
    },
    [
      fetchActions,
      fetchComments,
      issueId,
      refreshControlLinks,
      refreshRiskLinks,
      router,
    ],
  );

  const { user, authLoading } = useRequireAuth(loadPageData);

  const hasUnsavedChanges = useMemo(() => {
    if (!issue || !form) {
      return false;
    }

    return JSON.stringify(toForm(issue)) !== JSON.stringify(form);
  }, [form, issue]);

  function updateForm(updates: Partial<NewIssue>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !issue) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("issues")
        .update(toIssueFormPayload(form))
        .eq("id", issue.id);

      if (updateError) {
        throw updateError;
      }

      // Keep the workflow gates evaluating against saved values.
      setIssue({ ...issue, ...toIssueFormPayload(form) } as Issue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save issue");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!issue) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${issue.title}"? This also removes its action plan and activity trail.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("issues")
        .delete()
        .eq("id", issue.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/issues");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete issue");
      setDeleting(false);
    }
  }

  async function handleTransition(to: IssueStatus) {
    if (!issue || !user) {
      return;
    }

    const blockers = getTransitionBlockers(issue, actions, to);

    if (blockers.length > 0) {
      setError(blockers.join(" "));
      return;
    }

    setTransitioningTo(to);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const patch = getTransitionPatch(to);
      const { error: updateError } = await supabase
        .from("issues")
        .update(patch)
        .eq("id", issue.id);

      if (updateError) {
        throw updateError;
      }

      const { error: commentError } = await supabase
        .from("issue_comments")
        .insert({
          issue_id: issue.id,
          body: describeTransition(issue.status, to),
          kind: "status_change",
          owner_id: user.id,
          owner_email: user.email,
        });

      if (commentError) {
        throw commentError;
      }

      const updatedIssue = { ...issue, ...patch } as Issue;
      setIssue(updatedIssue);
      setForm(toForm(updatedIssue));
      await fetchComments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update issue status",
      );
    } finally {
      setTransitioningTo(null);
    }
  }

  async function handleAddAction(action: NewIssueAction) {
    if (!user) {
      return false;
    }

    setSavingAction(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: insertError } = await supabase
        .from("issue_actions")
        .insert({
          issue_id: issueId,
          description: action.description.trim(),
          assignee_email: action.assignee_email.trim(),
          due_date: action.due_date || null,
          status: action.status,
          owner_id: user.id,
          owner_email: user.email,
        });

      if (insertError) {
        throw insertError;
      }

      await fetchActions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add action");
      return false;
    } finally {
      setSavingAction(false);
    }
  }

  async function handleUpdateActionStatus(
    actionId: string,
    status: IssueActionStatus,
  ) {
    setUpdatingActionId(actionId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("issue_actions")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", actionId);

      if (updateError) {
        throw updateError;
      }

      await fetchActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update action");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleDeleteAction(actionId: string) {
    setUpdatingActionId(actionId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("issue_actions")
        .delete()
        .eq("id", actionId);

      if (deleteError) {
        throw deleteError;
      }

      await fetchActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete action");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleAddComment(body: string) {
    if (!user) {
      return false;
    }

    setSavingComment(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: insertError } = await supabase
        .from("issue_comments")
        .insert({
          issue_id: issueId,
          body,
          kind: "comment",
          owner_id: user.id,
          owner_email: user.email,
        });

      if (insertError) {
        throw insertError;
      }

      await fetchComments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
      return false;
    } finally {
      setSavingComment(false);
    }
  }

  if (authLoading || loading || !form || !issue) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header>
          <BackLink href="/issues">← Back to issues</BackLink>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {issue.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <IssueSeverityBadge
                  severity={issue.severity}
                  label={formatIssueSeverity(issue.severity)}
                />
                <span>{formatDueDateLabel(issue)}</span>
                {isIssueOverdue(issue) && <OverdueBadge />}
              </div>
            </div>
          </div>
        </header>

        <ErrorBanner message={error} />

        <WorkflowPanel
          issue={issue}
          actions={actions}
          transitioningTo={transitioningTo}
          unsavedChanges={hasUnsavedChanges}
          onTransition={(to) => void handleTransition(to)}
        />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Details
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <IssueFormFields
              form={form}
              onChange={updateForm}
              showClosureNotes={
                issue.status === "pending_review" || issue.status === "closed"
              }
            />

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting}
                className={primaryButtonClassName}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <Link href="/issues" className={secondaryButtonClassName}>
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting || deleting}
                className={dangerButtonClassName}
              >
                {deleting ? "Deleting..." : "Delete Issue"}
              </button>
            </div>
          </form>
        </section>

        <ActionPlanPanel
          actions={actions}
          saving={savingAction}
          updatingActionId={updatingActionId}
          onAdd={handleAddAction}
          onUpdateStatus={(actionId, status) =>
            void handleUpdateActionStatus(actionId, status)
          }
          onDelete={(actionId) => void handleDeleteAction(actionId)}
        />

        <LinkedEntitiesPanel
          title="Linked Risks"
          entityLabel="Risk"
          parentLabel="issue"
          createHref="/risks"
          columnHeaders={RISK_COLUMNS}
          rows={buildRiskRows(linkedRisks)}
          options={userRisks}
          {...riskPanelProps}
        />

        <LinkedEntitiesPanel
          title="Linked Controls"
          entityLabel="Control"
          parentLabel="issue"
          createHref="/controls"
          columnHeaders={CONTROL_COLUMNS}
          rows={buildControlRows(linkedControls)}
          options={userControls}
          {...controlPanelProps}
        />

        <ActivityTrailPanel
          comments={comments}
          saving={savingComment}
          onAddComment={handleAddComment}
        />
      </main>
    </div>
  );
}
