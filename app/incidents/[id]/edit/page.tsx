"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LinkedEntitiesPanel } from "@/app/components/linked-entities-panel";
import {
  buildRiskRows,
  RISK_COLUMNS_WITH_OWNER,
} from "@/app/components/linked-entity-rows";
import {
  BackLink,
  ErrorBanner,
  PageLoading,
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
import {
  formatDateForInput,
  nextResolvedAt,
  toIncidentFormPayload,
  type Incident,
  type NewIncident,
} from "@/lib/types/incident";
import {
  groupIncidentRiskRowsByIncident,
  INCIDENT_RISK_RISK_SELECT,
  type IncidentRiskRow,
} from "@/lib/types/incident-risk";
import type { LinkedRisk } from "@/lib/types/linked-entities";
import type { Risk } from "@/lib/types/risk";
import { IncidentFormFields } from "../../_components/incident-form-fields";

export default function EditIncidentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const incidentId = params.id;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [form, setForm] = useState<NewIncident | null>(null);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enterpriseReady } = useSettings();

  const {
    linked: linkedRisks,
    refresh: refreshRiskLinks,
    panelProps: riskPanelProps,
  } = useEntityLinks<IncidentRiskRow, LinkedRisk>({
    table: "incident_risks",
    select: INCIDENT_RISK_RISK_SELECT,
    parentColumn: "incident_id",
    parentId: incidentId,
    childColumn: "risk_id",
    parse: (rows) => groupIncidentRiskRowsByIncident(rows)[incidentId] ?? [],
    label: "risk",
    onError: setError,
  });

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("incidents")
          .select("*")
          .eq("id", incidentId)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          router.replace("/incidents");
          return;
        }

        const loadedIncident = data as Incident;
        setIncident(loadedIncident);
        setForm({
          title: loadedIncident.title,
          description: loadedIncident.description,
          date_occurred: formatDateForInput(loadedIncident.date_occurred),
          severity: loadedIncident.severity,
          status: loadedIncident.status,
          root_cause: loadedIncident.root_cause,
          assignee_id: loadedIncident.assignee_id ?? "",
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

        await refreshRiskLinks(ownerId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load incident",
        );
      } finally {
        setLoading(false);
      }
    },
    [incidentId, refreshRiskLinks, router],
  );

  const { user, authLoading } = useRequireAuth(loadPageData);

  const dirty = Boolean(
    form &&
      incident &&
      (form.title !== incident.title ||
        form.description !== incident.description ||
        form.date_occurred !== formatDateForInput(incident.date_occurred) ||
        form.severity !== incident.severity ||
        form.status !== incident.status ||
        form.root_cause !== incident.root_cause ||
        (form.assignee_id || "") !== (incident.assignee_id ?? "")),
  );
  const { confirmLeave } = useUnsavedChanges(dirty);

  function updateForm(updates: Partial<NewIncident>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !incident || !user) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await supabase
        .from("incidents")
        .update({
          ...toIncidentFormPayload(form, enterpriseReady),
          resolved_at: nextResolvedAt(form.status, incident.resolved_at),
        })
        .eq("id", incident.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update incident");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!incident || !user) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${incident.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("incidents")
        .delete()
        .eq("id", incident.id)
        .eq("owner_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete incident");
      setDeleting(false);
    }
  }

  if (authLoading || loading || !form || !incident) {
    return <PageLoading />;
  }

  // Post-incident reviews commonly raise remediation issues.
  const raiseIssueHref = `/issues/new?${new URLSearchParams({
    source: "incident",
    severity: incident.severity,
    title: `Post-incident action: ${incident.title}`,
    description: incident.root_cause
      ? `Root cause identified during incident review: ${incident.root_cause}`
      : "",
  }).toString()}`;

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BackLink href="/incidents">← Back to incidents</BackLink>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Edit Incident
            </h1>
          </div>
          <Link
            href={raiseIssueHref}
            className={`${secondaryButtonClassName} shrink-0`}
          >
            Raise Issue
          </Link>
        </header>

        <ErrorBanner message={error} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <IncidentFormFields form={form} onChange={updateForm} />

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
                    router.push("/incidents");
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
                {deleting ? "Deleting..." : "Delete Incident"}
              </button>
            </div>
          </form>
        </section>

        <LinkedEntitiesPanel
          title="Linked Risks"
          entityLabel="Risk"
          parentLabel="incident"
          createHref="/risks"
          columnHeaders={RISK_COLUMNS_WITH_OWNER}
          rows={buildRiskRows(linkedRisks, { includeOwner: true })}
          options={userRisks}
          {...riskPanelProps}
        />
      </main>
    </div>
  );
}
