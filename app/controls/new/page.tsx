"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading } from "@/app/components/page-parts";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { insertOwnedRecord } from "@/lib/supabase/records";
import { toControlFormPayload, type NewControl } from "@/lib/types/control";
import { ControlFormFields } from "../_components/control-form-fields";
import { EMPTY_CONTROL_FORM } from "../_components/constants";

export default function NewControlPage() {
  const router = useRouter();
  const [form, setForm] = useState<NewControl>(EMPTY_CONTROL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { authLoading } = useRequireAuth();

  function updateForm(updates: Partial<NewControl>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await insertOwnedRecord("controls", toControlFormPayload(form));
      router.push("/controls");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add control");
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <EntityFormPage
      backHref="/controls"
      backLabel="Back to controls"
      title="Add Control"
      error={error}
      submitting={submitting}
      submitLabel="Add Control"
      submittingLabel="Adding..."
      cancelHref="/controls"
      onSubmit={handleSubmit}
    >
      <ControlFormFields form={form} onChange={updateForm} />
    </EntityFormPage>
  );
}
