"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading } from "@/app/components/page-parts";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { insertOwnedRecord } from "@/lib/supabase/records";
import { useSettings } from "@/lib/settings/context";
import {
  nextResolvedAt,
  toIncidentFormPayload,
  type NewIncident,
} from "@/lib/types/incident";
import { EMPTY_INCIDENT_FORM } from "../_components/constants";
import { IncidentFormFields } from "../_components/incident-form-fields";

export default function NewIncidentPage() {
  const router = useRouter();
  const { enterpriseReady } = useSettings();
  const [form, setForm] = useState<NewIncident>(EMPTY_INCIDENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { authLoading } = useRequireAuth();

  function updateForm(updates: Partial<NewIncident>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await insertOwnedRecord("incidents", {
        ...toIncidentFormPayload(form, enterpriseReady),
        resolved_at: nextResolvedAt(form.status, null),
      });
      router.push("/incidents");
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
      backHref="/incidents"
      backLabel="Back to incidents"
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
      cancelHref="/incidents"
      onSubmit={handleSubmit}
    >
      <IncidentFormFields form={form} onChange={updateForm} />
    </EntityFormPage>
  );
}
