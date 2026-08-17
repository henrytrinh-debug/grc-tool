"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntityFormPage } from "@/app/components/entity-form-page";
import { PageLoading, SchemaNotice } from "@/app/components/page-parts";
import { inputClassName, labelClassName } from "@/app/components/ui";
import {
  loadEvidenceEntityOptions,
  type EvidenceEntityOption,
} from "@/lib/evidence/entities";
import { uploadEvidenceObject } from "@/lib/evidence/storage";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { insertOwnedRow } from "@/lib/supabase/records";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  EVIDENCE_ENTITY_OPTIONS,
  emptyEvidenceForm,
  toEvidencePayload,
  type EvidenceEntityType,
  type EvidenceRecord,
  type NewEvidence,
} from "@/lib/types/evidence";
import { EvidenceFormFields } from "../_components/evidence-form-fields";

function NewEvidencePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { evidenceReady, evidenceStorageReady } = useSettings();
  const entityTypeParam = searchParams.get("entityType") ?? "";
  const entityIdParam = searchParams.get("entityId") ?? "";
  const initialType = EVIDENCE_ENTITY_OPTIONS.some(
    (option) => option.value === entityTypeParam,
  )
    ? (entityTypeParam as EvidenceEntityType)
    : "risk";

  const [form, setForm] = useState<NewEvidence>(() =>
    emptyEvidenceForm(initialType, entityIdParam),
  );
  const [entityOptions, setEntityOptions] = useState<EvidenceEntityOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(
    async (ownerId: string) => {
      setEntityOptions(await loadEvidenceEntityOptions(ownerId, form.entity_type));
    },
    [form.entity_type],
  );

  const { user, authLoading } = useRequireAuth(loadOptions);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadEvidenceEntityOptions(user.id, form.entity_type).then(setEntityOptions);
  }, [form.entity_type, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidenceReady) {
      setError("Run 009_evidence.sql before adding evidence.");
      return;
    }
    if (!form.entity_id) {
      setError("Choose a linked record.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await insertOwnedRow<EvidenceRecord>(
        "evidence",
        toEvidencePayload(form),
      );

      if (file && evidenceStorageReady && user) {
        try {
          const uploaded = await uploadEvidenceObject(user.id, created.id, file);
          const supabase = getSupabaseClient();
          const { error: updateError } = await supabase
            .from("evidence")
            .update({
              storage_path: uploaded.path,
              original_filename: uploaded.filename,
            })
            .eq("id", created.id)
            .eq("owner_id", user.id);
          if (updateError) {
            throw updateError;
          }
        } catch (uploadError) {
          setError(
            uploadError instanceof Error
              ? `Evidence saved, but the file was not uploaded: ${uploadError.message}`
              : "Evidence saved, but the file was not uploaded.",
          );
          setSubmitting(false);
          router.push(`/evidence/${created.id}/edit`);
          return;
        }
      }

      router.push(`/evidence/${created.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add evidence");
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <EntityFormPage
      backHref="/evidence"
      backLabel="Back to evidence"
      title="Add evidence"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/evidence", label: "Evidence" },
        { label: "Add" },
      ]}
      error={error}
      submitting={submitting}
      submitLabel="Add evidence"
      submittingLabel="Adding..."
      cancelHref="/evidence"
      onSubmit={handleSubmit}
    >
      {!evidenceReady ? (
        <div className="sm:col-span-2">
          <SchemaNotice>
            Run <code className="font-mono">009_evidence.sql</code> first.
          </SchemaNotice>
        </div>
      ) : null}
      {evidenceReady && !evidenceStorageReady ? (
        <div className="sm:col-span-2">
          <SchemaNotice>
            File upload is unavailable until the private{" "}
            <code className="font-mono">grc-evidence</code> bucket is configured.
            Metadata can still be saved.
          </SchemaNotice>
        </div>
      ) : null}
      <EvidenceFormFields
        form={form}
        entityOptions={entityOptions}
        onChange={(updates) => setForm((current) => ({ ...current, ...updates }))}
      />
      {evidenceStorageReady ? (
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClassName}>File (optional, 10 MB max)</span>
          <input
            type="file"
            className={inputClassName}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
      ) : null}
    </EntityFormPage>
  );
}

export default function NewEvidencePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewEvidencePageContent />
    </Suspense>
  );
}
