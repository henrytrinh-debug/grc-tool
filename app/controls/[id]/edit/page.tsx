"use client";

import { FormEvent, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LinkedEntitiesPanel } from "@/app/components/linked-entities-panel";
import { EvidencePanel } from "@/app/components/evidence-panel";
import { QualityCallout } from "@/app/components/quality-indicator";
import {
  buildRiskRows,
  RISK_COLUMNS_WITH_OWNER,
} from "@/app/components/linked-entity-rows";
import {
  BackLink,
  ErrorBanner,
  PageLoading,
} from "@/app/components/page-parts";
import { RecordFeedback } from "@/app/components/record-feedback";
import { RelatedIssuesCard } from "@/app/components/related-issues-card";
import { ensureFollowUp } from "@/lib/feedback/ensure";
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
import { controlQuality } from "@/lib/data-quality/record";
import {
  controlEffectivenessBlockers,
  toControlFormPayload,
  type Control,
  type NewControl,
} from "@/lib/types/control";
import {
  toControlTestResultPayload,
  type ControlTestResult,
  type NewControlTestResult,
} from "@/lib/types/control-test-result";
import {
  groupIssuesByControl,
  ISSUE_CONTROL_ISSUE_SELECT,
  type IssueControlIssueRow,
} from "@/lib/types/issue-links";
import type { LinkedIssue, LinkedRisk } from "@/lib/types/linked-entities";
import type { Risk } from "@/lib/types/risk";
import {
  groupRiskControlRowsByControl,
  RISK_CONTROL_RISK_SELECT,
  type RiskControlRiskRow,
} from "@/lib/types/risk-control";
import { ControlFormFields } from "../../_components/control-form-fields";
import { TestHistoryPanel } from "../../_components/test-history-panel";

export default function EditControlPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const controlId = params.id;

  const [control, setControl] = useState<Control | null>(null);
  const [form, setForm] = useState<NewControl | null>(null);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [relatedIssues, setRelatedIssues] = useState<LinkedIssue[]>([]);
  const [testResults, setTestResults] = useState<ControlTestResult[]>([]);
  const [loadingTestResults, setLoadingTestResults] = useState(true);
  const [recordingTest, setRecordingTest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enterpriseReady, feedbackReady, people } = useSettings();

  const fetchTestResults = useCallback(
    async (ownerId: string) => {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("control_test_results")
        .select("*")
        .eq("control_id", controlId)
        .eq("owner_id", ownerId)
        .order("tested_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setTestResults((data ?? []) as ControlTestResult[]);
    },
    [controlId],
  );

  const {
    linked: linkedRisks,
    refresh: refreshRiskLinks,
    panelProps: riskPanelProps,
  } = useEntityLinks<RiskControlRiskRow, LinkedRisk>({
    table: "risk_controls",
    select: RISK_CONTROL_RISK_SELECT,
    parentColumn: "control_id",
    parentId: controlId,
    childColumn: "risk_id",
    parse: (rows) => groupRiskControlRowsByControl(rows)[controlId] ?? [],
    label: "risk",
    onError: setError,
  });

  const fetchRelatedIssues = useCallback(
    async (ownerId: string) => {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("issue_controls")
        .select(ISSUE_CONTROL_ISSUE_SELECT)
        .eq("owner_id", ownerId)
        .eq("control_id", controlId);

      if (fetchError) {
        throw fetchError;
      }

      const grouped = groupIssuesByControl(
        (data ?? []) as IssueControlIssueRow[],
      );
      setRelatedIssues(grouped[controlId] ?? []);
    },
    [controlId],
  );

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("controls")
          .select("*")
          .eq("id", controlId)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          router.replace("/controls");
          return;
        }

        const loadedControl = data as Control;
        setControl(loadedControl);
        setForm({
          title: loadedControl.title,
          description: loadedControl.description,
          is_key: loadedControl.is_key,
          effectiveness: loadedControl.effectiveness,
          last_tested_at: loadedControl.last_tested_at,
          assignee_id: loadedControl.assignee_id ?? "",
          control_type: loadedControl.control_type ?? "preventive",
        });

        const risksResult = await supabase
          .from("risks")
          .select("*")
          .eq("owner_id", ownerId)
          .order("title", { ascending: true });

        if (risksResult.error) {
          throw risksResult.error;
        }

        setUserRisks((risksResult.data ?? []) as Risk[]);

        await Promise.all([
          refreshRiskLinks(ownerId),
          fetchTestResults(ownerId),
          fetchRelatedIssues(ownerId),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load control");
      } finally {
        setLoading(false);
        setLoadingTestResults(false);
      }
    },
    [controlId, fetchRelatedIssues, fetchTestResults, refreshRiskLinks, router],
  );

  const { user, authLoading } = useRequireAuth(loadPageData);

  const dirty = Boolean(
    form &&
      control &&
      (form.title !== control.title ||
        form.description !== control.description ||
        form.is_key !== control.is_key ||
        form.effectiveness !== control.effectiveness ||
        (form.last_tested_at || "") !== (control.last_tested_at || "") ||
        (form.assignee_id || "") !== (control.assignee_id ?? "") ||
        (form.control_type ?? "preventive") !==
          (control.control_type ?? "preventive")),
  );
  const { confirmLeave } = useUnsavedChanges(dirty);

  function updateForm(updates: Partial<NewControl>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !control || !user) {
      return;
    }

    const blockers = controlEffectivenessBlockers(form, {
      hasTestHistory: testResults.length > 0,
    });
    if (blockers.length > 0) {
      setError(blockers.join(" "));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("controls")
        .update(toControlFormPayload(form, enterpriseReady))
        .eq("id", control.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/controls");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update control");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!control || !user) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${control.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("controls")
        .delete()
        .eq("id", control.id)
        .eq("owner_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/controls");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete control");
      setDeleting(false);
    }
  }

  async function handleRecordTestResult(payload: NewControlTestResult) {
    if (!user || !control) {
      throw new Error("You must be signed in to record a test result");
    }

    if (!user.email) {
      throw new Error("User email not available");
    }

    setRecordingTest(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const testPayload = toControlTestResultPayload(payload);

      const { error: insertError } = await supabase
        .from("control_test_results")
        .insert({
          ...testPayload,
          control_id: controlId,
          owner_id: user.id,
          owner_email: user.email,
        });

      if (insertError) {
        throw insertError;
      }

      // Keep the control record in sync so the list view reflects the latest test.
      const { error: updateError } = await supabase
        .from("controls")
        .update({
          effectiveness: testPayload.effectiveness,
          last_tested_at: testPayload.tested_at,
        })
        .eq("id", control.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setControl((current) =>
        current
          ? {
              ...current,
              effectiveness: testPayload.effectiveness,
              last_tested_at: testPayload.tested_at,
            }
          : current,
      );
      setForm((current) =>
        current
          ? {
              ...current,
              effectiveness: testPayload.effectiveness,
              last_tested_at: testPayload.tested_at,
            }
          : current,
      );

      await fetchTestResults(user.id);

      if (testPayload.effectiveness === "ineffective" && user.email) {
        await ensureFollowUp(
          supabase,
          { id: user.id, email: user.email },
          {
            title: "Remediate and retest after an ineffective result",
            description:
              "The latest test found this control ineffective. Confirm design/operating effectiveness and record a new test.",
            entityType: "control",
            entityId: control.id,
            trigger: "ineffective_test",
          },
        ).catch(() => undefined);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to record test result";
      setError(message);
      throw err;
    } finally {
      setRecordingTest(false);
    }
  }

  if (authLoading || loading || !form || !control) {
    return <PageLoading />;
  }

  const raiseIssueHref = `/issues/new?${new URLSearchParams({
    source: "control_failure",
    control: controlId,
    title: `Control gap: ${control.title}`,
  }).toString()}`;
  const quality = controlQuality(form, {
    mappedToRisk: linkedRisks.length > 0,
    enterpriseReady,
  });

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <BackLink href="/controls">← Back to controls</BackLink>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Edit Control
          </h1>
        </header>

        <ErrorBanner message={error} />

        <QualityCallout summary={quality} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <ControlFormFields
              form={form}
              onChange={updateForm}
              hasTestHistory={testResults.length > 0}
            />

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting}
                className={primaryButtonClassName}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  if (confirmLeave()) {
                    router.push("/controls");
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
                {deleting ? "Deleting..." : "Delete Control"}
              </button>
            </div>
          </form>
        </section>

        <TestHistoryPanel
          controlId={controlId}
          controlTitle={control.title}
          testResults={testResults}
          loading={loadingTestResults}
          recording={recordingTest}
          onRecordTestResult={handleRecordTestResult}
        />

        <RelatedIssuesCard
          issues={relatedIssues}
          raiseIssueHref={raiseIssueHref}
          emptyMessage="No issues have been raised against this control."
        />

        <LinkedEntitiesPanel
          title="Linked Risks"
          entityLabel="Risk"
          parentLabel="control"
          createHref="/risks"
          columnHeaders={RISK_COLUMNS_WITH_OWNER}
          rows={buildRiskRows(linkedRisks, { includeOwner: true })}
          options={userRisks}
          {...riskPanelProps}
        />

        <EvidencePanel entityType="control" entityId={controlId} />

        <RecordFeedback
          entityType="control"
          entityId={controlId}
          enabled={feedbackReady}
          owner={user?.email ? { id: user.id, email: user.email } : null}
          people={people}
        />
      </main>
    </div>
  );
}
