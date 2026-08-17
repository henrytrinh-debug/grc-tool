"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading } from "@/app/components/page-parts";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { safeReturnTo } from "@/lib/navigation";
import { insertOwnedRow } from "@/lib/supabase/records";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings/context";
import { toControlFormPayload, type Control, type NewControl } from "@/lib/types/control";
import { ControlFormFields } from "../_components/control-form-fields";
import { EMPTY_CONTROL_FORM } from "../_components/constants";

function NewControlPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enterpriseReady } = useSettings();
  const [form, setForm] = useState<NewControl>(EMPTY_CONTROL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const riskId = searchParams.get("risk");
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  const { user, authLoading } = useRequireAuth();

  function updateForm(updates: Partial<NewControl>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = await insertOwnedRow<Control>(
        "controls",
        toControlFormPayload(form, enterpriseReady),
      );

      if (riskId && user) {
        const { error: linkError } = await getSupabaseClient()
          .from("risk_controls")
          .insert({
            risk_id: riskId,
            control_id: created.id,
            owner_id: user.id,
          });
        if (linkError) {
          throw linkError;
        }
      }

      router.push(returnTo ?? "/controls");
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
      backHref={returnTo ?? "/controls"}
      backLabel={returnTo ? "Back" : "Back to controls"}
      title="Add Control"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/controls", label: "Controls" },
        { label: "Add" },
      ]}
      error={error}
      submitting={submitting}
      submitLabel="Add Control"
      submittingLabel="Adding..."
      cancelHref={returnTo ?? "/controls"}
      onSubmit={handleSubmit}
    >
      <ControlFormFields form={form} onChange={updateForm} />
    </EntityFormPage>
  );
}

export default function NewControlPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewControlPageContent />
    </Suspense>
  );
}
