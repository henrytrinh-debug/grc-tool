"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading, SchemaNotice } from "@/app/components/page-parts";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { insertOwnedRow } from "@/lib/supabase/records";
import { useSettings } from "@/lib/settings/context";
import {
  EMPTY_OBLIGATION_FORM,
  toObligationPayload,
  type NewObligation,
} from "@/lib/types/obligation";
import { ObligationFormFields } from "../_components/obligation-form-fields";

export default function NewObligationPage() {
  const router = useRouter();
  const { obligationsReady } = useSettings();
  const [form, setForm] = useState<NewObligation>(EMPTY_OBLIGATION_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authLoading } = useRequireAuth();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!obligationsReady) {
      setError("Run 008_obligations.sql before adding obligations.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await insertOwnedRow<{ id: string }>(
        "obligations",
        toObligationPayload(form),
      );
      router.push(`/obligations/${created.id}/edit`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add obligation",
      );
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <EntityFormPage
      backHref="/obligations"
      backLabel="Back to obligations"
      title="Add obligation"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/obligations", label: "Obligations" },
        { label: "Add" },
      ]}
      error={error}
      submitting={submitting}
      submitLabel="Add obligation"
      submittingLabel="Adding..."
      cancelHref="/obligations"
      onSubmit={handleSubmit}
    >
      {!obligationsReady ? (
        <div className="sm:col-span-2">
          <SchemaNotice>
            Run <code className="font-mono">008_obligations.sql</code> first.
          </SchemaNotice>
        </div>
      ) : null}
      <ObligationFormFields
        form={form}
        onChange={(updates) => setForm((current) => ({ ...current, ...updates }))}
      />
    </EntityFormPage>
  );
}
