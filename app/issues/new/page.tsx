"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import {
  ErrorBanner,
  PageLoading,
} from "@/app/components/page-parts";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  getDefaultDueDate,
  ISSUE_SOURCE_OPTIONS,
  toIssueFormPayload,
  type IssueSeverity,
  type IssueSource,
  type NewIssue,
} from "@/lib/types/issue";
import { IssueFormFields } from "../_components/issue-form-fields";
import { createEmptyIssueForm } from "../_components/constants";

const VALID_SOURCES = new Set(ISSUE_SOURCE_OPTIONS.map((option) => option.value));
const VALID_SEVERITIES = new Set<IssueSeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

function NewIssuePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Issues can be raised in context from a failed control test, a risk
   * assessment, or an incident, which pre-fills the form and pre-links the
   * originating record.
   */
  const prefill = useMemo(() => {
    const sourceParam = searchParams.get("source") ?? "";
    const severityParam = searchParams.get("severity") ?? "";

    return {
      title: searchParams.get("title") ?? "",
      description: searchParams.get("description") ?? "",
      source: VALID_SOURCES.has(sourceParam as IssueSource)
        ? (sourceParam as IssueSource)
        : null,
      severity: VALID_SEVERITIES.has(severityParam as IssueSeverity)
        ? (severityParam as IssueSeverity)
        : null,
      riskId: searchParams.get("risk"),
      controlId: searchParams.get("control"),
    };
  }, [searchParams]);

  const [form, setForm] = useState<NewIssue>(() => {
    const base = createEmptyIssueForm();
    const severity = prefill.severity ?? base.severity;

    return {
      ...base,
      title: prefill.title || base.title,
      description: prefill.description || base.description,
      source: prefill.source ?? base.source,
      severity,
      due_date: getDefaultDueDate(severity),
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, authLoading } = useRequireAuth();
  const { enterpriseReady } = useSettings();

  const updateForm = useCallback((updates: Partial<NewIssue>) => {
    setForm((current) => {
      const next = { ...current, ...updates };

      // Keep the target date aligned with the severity-based SLA unless the
      // user edits the date itself.
      if (updates.severity && !updates.due_date) {
        next.due_date = getDefaultDueDate(updates.severity);
      }

      return next;
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: insertError } = await supabase
        .from("issues")
        .insert({
          ...toIssueFormPayload(form, enterpriseReady),
          status: "open",
          owner_id: user.id,
          owner_email: user.email,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      const issueId = data.id as string;

      const [commentResult, riskResult, controlResult] = await Promise.all([
        supabase.from("issue_comments").insert({
          issue_id: issueId,
          body: "Issue raised.",
          kind: "status_change",
          owner_id: user.id,
          owner_email: user.email,
        }),
        prefill.riskId
          ? supabase.from("issue_risks").insert({
              issue_id: issueId,
              risk_id: prefill.riskId,
              owner_id: user.id,
            })
          : Promise.resolve({ error: null }),
        prefill.controlId
          ? supabase.from("issue_controls").insert({
              issue_id: issueId,
              control_id: prefill.controlId,
              owner_id: user.id,
            })
          : Promise.resolve({ error: null }),
      ]);

      const followUpError =
        commentResult.error ?? riskResult.error ?? controlResult.error;

      if (followUpError) {
        router.push(`/issues/${issueId}/edit`);
        return;
      }

      // Land on the edit page so the action plan can be built straight away.
      router.push(`/issues/${issueId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header>
          <Breadcrumbs
            items={[
              { href: "/", label: "Home" },
              { href: "/issues", label: "Issues" },
              { label: "Raise" },
            ]}
          />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Raise Issue
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            New issues start as Open. You will build the action plan on the next
            screen.
          </p>
        </header>

        <ErrorBanner message={error} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <IssueFormFields form={form} onChange={updateForm} />

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className={primaryButtonClassName}
              >
                {submitting ? "Raising..." : "Raise Issue"}
              </button>
              <Link href="/issues" className={secondaryButtonClassName}>
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function NewIssuePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewIssuePageContent />
    </Suspense>
  );
}
