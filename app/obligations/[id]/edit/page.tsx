"use client";

import { FormEvent, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EvidencePanel } from "@/app/components/evidence-panel";
import { QualityCallout } from "@/app/components/quality-indicator";
import { LinkedEntitiesPanel } from "@/app/components/linked-entities-panel";
import {
  buildControlRows,
  buildIssueRows,
  CONTROL_COLUMNS,
  ISSUE_COLUMNS,
} from "@/app/components/linked-entity-rows";
import {
  BackLink,
  ErrorBanner,
  PageLoading,
  SchemaNotice,
} from "@/app/components/page-parts";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { useEntityLinks } from "@/lib/hooks/use-entity-links";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings/context";
import { obligationQuality } from "@/lib/data-quality/record";
import type { Control } from "@/lib/types/control";
import type { Issue } from "@/lib/types/issue";
import type { LinkedControl, LinkedIssue } from "@/lib/types/linked-entities";
import {
  toObligationPayload,
  type NewObligation,
  type ObligationRecord,
} from "@/lib/types/obligation";
import {
  groupControlsByObligation,
  groupIssuesByObligation,
  OBLIGATION_CONTROL_SELECT,
  OBLIGATION_ISSUE_SELECT,
  type ObligationControlRow,
  type ObligationIssueRow,
} from "@/lib/types/obligation-links";
import { ObligationFormFields } from "../../_components/obligation-form-fields";

function toForm(record: ObligationRecord): NewObligation {
  return {
    title: record.title,
    source: record.source,
    citation: record.citation,
    requirement_text: record.requirement_text,
    status: record.status,
    review_frequency_days: record.review_frequency_days,
    effective_date: record.effective_date ?? "",
    review_date: record.review_date ?? "",
    assignee_id: record.assignee_id ?? "",
  };
}

export default function EditObligationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const obligationId = params.id;
  const { obligationsReady } = useSettings();

  const [record, setRecord] = useState<ObligationRecord | null>(null);
  const [form, setForm] = useState<NewObligation | null>(null);
  const [userControls, setUserControls] = useState<Control[]>([]);
  const [userIssues, setUserIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    linked: linkedControls,
    refresh: refreshControlLinks,
    panelProps: controlPanelProps,
  } = useEntityLinks<ObligationControlRow, LinkedControl>({
    table: "obligation_controls",
    select: OBLIGATION_CONTROL_SELECT,
    parentColumn: "obligation_id",
    parentId: obligationId,
    childColumn: "control_id",
    parse: (rows) => groupControlsByObligation(rows)[obligationId] ?? [],
    label: "control",
    onError: setError,
  });

  const {
    linked: linkedIssues,
    refresh: refreshIssueLinks,
    panelProps: issuePanelProps,
  } = useEntityLinks<ObligationIssueRow, LinkedIssue>({
    table: "obligation_issues",
    select: OBLIGATION_ISSUE_SELECT,
    parentColumn: "obligation_id",
    parentId: obligationId,
    childColumn: "issue_id",
    parse: (rows) => groupIssuesByObligation(rows)[obligationId] ?? [],
    label: "issue",
    onError: setError,
  });

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("obligations")
          .select("*")
          .eq("id", obligationId)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          router.replace("/obligations");
          return;
        }

        const loaded = data as ObligationRecord;
        setRecord(loaded);
        setForm(toForm(loaded));

        const [controlsResult, issuesResult] = await Promise.all([
          supabase
            .from("controls")
            .select("*")
            .eq("owner_id", ownerId)
            .order("title", { ascending: true }),
          supabase
            .from("issues")
            .select("*")
            .eq("owner_id", ownerId)
            .order("title", { ascending: true }),
        ]);

        if (controlsResult.error) {
          throw controlsResult.error;
        }
        if (issuesResult.error) {
          throw issuesResult.error;
        }

        setUserControls((controlsResult.data ?? []) as Control[]);
        setUserIssues((issuesResult.data ?? []) as Issue[]);

        await Promise.all([
          refreshControlLinks(ownerId),
          refreshIssueLinks(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load obligation",
        );
      } finally {
        setLoading(false);
      }
    },
    [obligationId, refreshControlLinks, refreshIssueLinks, router],
  );

  const { user, authLoading } = useRequireAuth(loadPageData);

  const dirty = Boolean(
    form &&
      record &&
      (form.title !== record.title ||
        form.source !== record.source ||
        form.citation !== record.citation ||
        form.requirement_text !== record.requirement_text ||
        form.status !== record.status ||
        form.review_frequency_days !== record.review_frequency_days ||
        (form.effective_date || "") !== (record.effective_date ?? "") ||
        (form.review_date || "") !== (record.review_date ?? "") ||
        (form.assignee_id || "") !== (record.assignee_id ?? "")),
  );
  const { confirmLeave } = useUnsavedChanges(dirty);

  function updateForm(updates: Partial<NewObligation>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !record || !user) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("obligations")
        .update(toObligationPayload(form))
        .eq("id", record.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/obligations");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update obligation",
      );
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!record || !user) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${record.title}"? This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("obligations")
        .delete()
        .eq("id", record.id)
        .eq("owner_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/obligations");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete obligation",
      );
      setDeleting(false);
    }
  }

  if (authLoading || loading || !form || !record) {
    return <PageLoading />;
  }

  const quality = obligationQuality(form, {
    mappedToControl: linkedControls.length > 0,
  });

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header>
          <BackLink href="/obligations">← Back to obligations</BackLink>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Edit obligation
          </h1>
        </header>

        {!obligationsReady ? (
          <SchemaNotice>
            Run <code className="font-mono">008_obligations.sql</code> first.
          </SchemaNotice>
        ) : null}

        <ErrorBanner message={error} />

        <QualityCallout summary={quality} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <ObligationFormFields form={form} onChange={updateForm} />
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting || !obligationsReady}
                className={primaryButtonClassName}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  if (confirmLeave()) {
                    router.push("/obligations");
                  }
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting || deleting}
                className={dangerButtonClassName}
              >
                {deleting ? "Deleting..." : "Delete obligation"}
              </button>
            </div>
          </form>
        </section>

        <LinkedEntitiesPanel
          title="Mapped controls"
          entityLabel="Control"
          parentLabel="obligation"
          createHref="/controls"
          columnHeaders={CONTROL_COLUMNS}
          rows={buildControlRows(linkedControls)}
          options={userControls}
          {...controlPanelProps}
        />

        <LinkedEntitiesPanel
          title="Related issues"
          entityLabel="Issue"
          parentLabel="obligation"
          createHref="/issues"
          columnHeaders={ISSUE_COLUMNS}
          rows={buildIssueRows(linkedIssues)}
          options={userIssues}
          {...issuePanelProps}
        />

        <EvidencePanel entityType="obligation" entityId={obligationId} />
      </main>
    </div>
  );
}
