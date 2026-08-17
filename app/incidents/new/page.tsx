"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading, SchemaNotice } from "@/app/components/page-parts";
import { incidentGovernanceBlockers, incidentGovernancePrompts } from "@/lib/governance/gates";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { safeReturnTo } from "@/lib/navigation";
import { insertOwnedRow } from "@/lib/supabase/records";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings/context";
import {
  nextResolvedAt,
  toIncidentFormPayload,
  type Incident,
  type NewIncident,
} from "@/lib/types/incident";
import { EMPTY_INCIDENT_FORM } from "../_components/constants";
import { IncidentFormFields } from "../_components/incident-form-fields";

function NewIncidentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enterpriseReady, operatingReady } = useSettings();
  const [form, setForm] = useState<NewIncident>(EMPTY_INCIDENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const riskId = searchParams.get("risk");
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  const { user, authLoading } = useRequireAuth();

  function updateForm(updates: Partial<NewIncident>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const blockers = incidentGovernanceBlockers(form);
    if (blockers.length > 0) {
      setError(blockers.join(" "));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await insertOwnedRow<Incident>("incidents", {
        ...toIncidentFormPayload(form, {
          includeEnterprise: enterpriseReady,
          includeOperating: operatingReady,
        }),
        resolved_at: nextResolvedAt(form.status, null),
      });

      if (riskId && user) {
        const { error: linkError } = await getSupabaseClient()
          .from("incident_risks")
          .insert({
            incident_id: created.id,
            risk_id: riskId,
            owner_id: user.id,
          });
        if (linkError) {
          throw linkError;
        }
      }

      router.push(returnTo ?? "/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add incident");
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <EntityFormPage
      backHref={returnTo ?? "/incidents"}
      backLabel={returnTo ? "Back" : "Back to incidents"}
      title="Add Incident"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/incidents", label: "Incidents" },
        { label: "Add" },
      ]}
      error={error}
      submitting={submitting}
      submitLabel="Add Incident"
      submittingLabel="Adding..."
      cancelHref={returnTo ?? "/incidents"}
      onSubmit={handleSubmit}
    >
      {incidentGovernancePrompts(form, operatingReady).map((prompt) => (
        <div key={prompt} className="sm:col-span-2">
          <SchemaNotice>{prompt}</SchemaNotice>
        </div>
      ))}
      <IncidentFormFields form={form} onChange={updateForm} />
    </EntityFormPage>
  );
}

export default function NewIncidentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewIncidentPageContent />
    </Suspense>
  );
}
