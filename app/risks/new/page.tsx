"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading } from "@/app/components/page-parts";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { insertOwnedRecord } from "@/lib/supabase/records";
import { useSettings } from "@/lib/settings/context";
import { toRiskFormPayload, type NewRisk } from "@/lib/types/risk";
import { EMPTY_RISK_FORM } from "../_components/constants";
import { RiskFormFields } from "../_components/risk-form-fields";

export default function NewRiskPage() {
  const router = useRouter();
  const { schemaReady } = useSettings();
  const [form, setForm] = useState<NewRisk>(EMPTY_RISK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { authLoading } = useRequireAuth();

  function updateForm(updates: Partial<NewRisk>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await insertOwnedRecord("risks", toRiskFormPayload(form, schemaReady));
      router.push("/risks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add risk");
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <EntityFormPage
      backHref="/risks"
      backLabel="Back to risks"
      title="Add Risk"
      error={error}
      submitting={submitting}
      submitLabel="Add Risk"
      submittingLabel="Adding..."
      cancelHref="/risks"
      onSubmit={handleSubmit}
    >
      <RiskFormFields form={form} onChange={updateForm} />
    </EntityFormPage>
  );
}
