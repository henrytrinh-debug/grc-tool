"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LinkedEntitiesPanel } from "@/app/components/linked-entities-panel";
import {
  buildControlRows,
  buildIncidentRows,
  CONTROL_COLUMNS,
  INCIDENT_COLUMNS,
} from "@/app/components/linked-entity-rows";
import {
  BackLink,
  ErrorBanner,
  PageLoading,
} from "@/app/components/page-parts";
import { RelatedIssuesCard } from "@/app/components/related-issues-card";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { useEntityLinks } from "@/lib/hooks/use-entity-links";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import {
  groupIncidentRiskRowsByRisk,
  INCIDENT_RISK_INCIDENT_SELECT,
  type IncidentRiskIncidentRow,
} from "@/lib/types/incident-risk";
import {
  groupIssuesByRisk,
  ISSUE_RISK_ISSUE_SELECT,
  type IssueRiskIssueRow,
} from "@/lib/types/issue-links";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedIssue,
} from "@/lib/types/linked-entities";
import { useSettings } from "@/lib/settings/context";
import { toRiskFormPayload, type NewRisk, type Risk } from "@/lib/types/risk";
import {
  groupRiskControlRows,
  RISK_CONTROL_SELECT,
  type RiskControlRow,
} from "@/lib/types/risk-control";
import { RiskFormFields } from "../../_components/risk-form-fields";

export default function EditRiskPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const riskId = params.id;

  const [risk, setRisk] = useState<Risk | null>(null);
  const [form, setForm] = useState<NewRisk | null>(null);
  const [userControls, setUserControls] = useState<Control[]>([]);
  const [userIncidents, setUserIncidents] = useState<Incident[]>([]);
  const [relatedIssues, setRelatedIssues] = useState<LinkedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { schemaReady } = useSettings();

  const {
    linked: linkedControls,
    refresh: refreshControlLinks,
    panelProps: controlPanelProps,
  } = useEntityLinks<RiskControlRow, LinkedControl>({
    table: "risk_controls",
    select: RISK_CONTROL_SELECT,
    parentColumn: "risk_id",
    parentId: riskId,
    childColumn: "control_id",
    parse: (rows) => groupRiskControlRows(rows)[riskId] ?? [],
    label: "control",
    onError: setError,
  });

  const {
    linked: linkedIncidents,
    refresh: refreshIncidentLinks,
    panelProps: incidentPanelProps,
  } = useEntityLinks<IncidentRiskIncidentRow, LinkedIncident>(
    {
      table: "incident_risks",
      select: INCIDENT_RISK_INCIDENT_SELECT,
      parentColumn: "risk_id",
      parentId: riskId,
      childColumn: "incident_id",
      parse: (rows) => groupIncidentRiskRowsByRisk(rows)[riskId] ?? [],
      label: "incident",
      onError: setError,
    },
  );

  const fetchRelatedIssues = useCallback(
    async (ownerId: string) => {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("issue_risks")
        .select(ISSUE_RISK_ISSUE_SELECT)
        .eq("owner_id", ownerId)
        .eq("risk_id", riskId);

      if (fetchError) {
        throw fetchError;
      }

      const grouped = groupIssuesByRisk((data ?? []) as IssueRiskIssueRow[]);
      setRelatedIssues(grouped[riskId] ?? []);
    },
    [riskId],
  );

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("risks")
          .select("*")
          .eq("id", riskId)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          router.replace("/risks");
          return;
        }

        const loadedRisk = data as Risk;
        setRisk(loadedRisk);
        setForm({
          title: loadedRisk.title,
          description: loadedRisk.description,
          likelihood: loadedRisk.likelihood,
          impact: loadedRisk.impact,
          category_id: loadedRisk.category_id ?? "",
          treatment: loadedRisk.treatment ?? "mitigate",
        });

        const [controlsResult, incidentsResult] = await Promise.all([
          supabase
            .from("controls")
            .select("*")
            .eq("owner_id", ownerId)
            .order("title", { ascending: true }),
          supabase
            .from("incidents")
            .select("*")
            .eq("owner_id", ownerId)
            .order("title", { ascending: true }),
        ]);

        if (controlsResult.error) {
          throw controlsResult.error;
        }

        if (incidentsResult.error) {
          throw incidentsResult.error;
        }

        setUserControls((controlsResult.data ?? []) as Control[]);
        setUserIncidents((incidentsResult.data ?? []) as Incident[]);

        await Promise.all([
          refreshControlLinks(ownerId),
          refreshIncidentLinks(ownerId),
          fetchRelatedIssues(ownerId),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load risk");
      } finally {
        setLoading(false);
      }
    },
    [
      fetchRelatedIssues,
      refreshControlLinks,
      refreshIncidentLinks,
      riskId,
      router,
    ],
  );

  const { user, authLoading } = useRequireAuth(loadPageData);

  const dirty = Boolean(
    form &&
      risk &&
      (form.title !== risk.title ||
        form.description !== risk.description ||
        form.likelihood !== risk.likelihood ||
        form.impact !== risk.impact ||
        (form.category_id || "") !== (risk.category_id ?? "") ||
        (form.treatment ?? "mitigate") !== (risk.treatment ?? "mitigate")),
  );
  const { confirmLeave } = useUnsavedChanges(dirty);

  function updateForm(updates: Partial<NewRisk>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !risk || !user) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("risks")
        .update(toRiskFormPayload(form, schemaReady))
        .eq("id", risk.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/risks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update risk");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!risk || !user) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${risk.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("risks")
        .delete()
        .eq("id", risk.id)
        .eq("owner_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/risks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete risk");
      setDeleting(false);
    }
  }

  if (authLoading || loading || !form || !risk) {
    return <PageLoading />;
  }

  const raiseIssueHref = `/issues/new?${new URLSearchParams({
    source: "risk_assessment",
    risk: riskId,
    title: `Issue identified for risk: ${risk.title}`,
  }).toString()}`;

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BackLink href="/risks">← Back to risks</BackLink>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Edit Risk
            </h1>
          </div>
          <Link
            href={`/rcsa/review?risk=${risk.id}`}
            className={`${primaryButtonClassName} shrink-0`}
          >
            Review This Risk
          </Link>
        </header>

        <ErrorBanner message={error} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <RiskFormFields form={form} onChange={updateForm} />

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
                    router.push("/risks");
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
                {deleting ? "Deleting..." : "Delete Risk"}
              </button>
            </div>
          </form>
        </section>

        <RelatedIssuesCard
          issues={relatedIssues}
          raiseIssueHref={raiseIssueHref}
          emptyMessage="No issues have been raised against this risk."
        />

        <LinkedEntitiesPanel
          title="Linked Controls"
          entityLabel="Control"
          parentLabel="risk"
          createHref="/controls"
          columnHeaders={CONTROL_COLUMNS}
          rows={buildControlRows(linkedControls)}
          options={userControls}
          {...controlPanelProps}
        />

        <LinkedEntitiesPanel
          title="Linked Incidents"
          entityLabel="Incident"
          parentLabel="risk"
          createHref="/incidents"
          columnHeaders={INCIDENT_COLUMNS}
          rows={buildIncidentRows(linkedIncidents)}
          options={userIncidents}
          {...incidentPanelProps}
        />
      </main>
    </div>
  );
}
