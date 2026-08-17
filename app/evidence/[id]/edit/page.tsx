"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QualityCallout } from "@/app/components/quality-indicator";
import {
  BackLink,
  ErrorBanner,
  PageLoading,
  SchemaNotice,
} from "@/app/components/page-parts";
import {
  dangerButtonClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import {
  loadEvidenceEntityOptions,
  type EvidenceEntityOption,
} from "@/lib/evidence/entities";
import {
  removeEvidenceObject,
  signedEvidenceUrl,
  uploadEvidenceObject,
} from "@/lib/evidence/storage";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { useSettings } from "@/lib/settings/context";
import { evidenceQuality } from "@/lib/data-quality/record";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  toEvidencePayload,
  type EvidenceRecord,
  type NewEvidence,
} from "@/lib/types/evidence";
import { EvidenceFormFields } from "../../_components/evidence-form-fields";

function toForm(record: EvidenceRecord): NewEvidence {
  return {
    title: record.title,
    description: record.description,
    evidence_date: record.evidence_date ?? "",
    source: record.source,
    retention_date: record.retention_date ?? "",
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    assignee_id: record.assignee_id ?? "",
  };
}

export default function EditEvidencePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const evidenceId = params.id;
  const { evidenceReady, evidenceStorageReady } = useSettings();

  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [form, setForm] = useState<NewEvidence | null>(null);
  const [entityOptions, setEntityOptions] = useState<EvidenceEntityOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("evidence")
          .select("*")
          .eq("id", evidenceId)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }
        if (!data) {
          router.replace("/evidence");
          return;
        }

        const loaded = data as EvidenceRecord;
        setRecord(loaded);
        setForm(toForm(loaded));
        setEntityOptions(
          await loadEvidenceEntityOptions(ownerId, loaded.entity_type),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load evidence");
      } finally {
        setLoading(false);
      }
    },
    [evidenceId, router],
  );

  const { user, authLoading } = useRequireAuth(loadPageData);

  const entityType = form?.entity_type;

  useEffect(() => {
    if (!user || !entityType) {
      return;
    }
    void loadEvidenceEntityOptions(user.id, entityType).then(setEntityOptions);
  }, [entityType, user]);

  const dirty = Boolean(
    form &&
      record &&
      (form.title !== record.title ||
        form.description !== record.description ||
        (form.evidence_date || "") !== (record.evidence_date ?? "") ||
        form.source !== record.source ||
        (form.retention_date || "") !== (record.retention_date ?? "") ||
        form.entity_type !== record.entity_type ||
        form.entity_id !== record.entity_id ||
        (form.assignee_id || "") !== (record.assignee_id ?? "") ||
        Boolean(file)),
  );
  const { confirmLeave } = useUnsavedChanges(dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !record || !user) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      let storagePath = record.storage_path ?? null;
      let originalFilename = record.original_filename ?? "";

      if (file && evidenceStorageReady) {
        const uploaded = await uploadEvidenceObject(user.id, record.id, file);
        storagePath = uploaded.path;
        originalFilename = uploaded.filename;
      }

      const { error: updateError } = await supabase
        .from("evidence")
        .update({
          ...toEvidencePayload(form),
          storage_path: storagePath,
          original_filename: originalFilename,
        })
        .eq("id", record.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/evidence");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update evidence");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!record || !user) {
      return;
    }
    const confirmed = window.confirm(
      `Delete "${record.title}"? This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      if (record.storage_path && evidenceStorageReady) {
        try {
          await removeEvidenceObject(record.storage_path);
        } catch {
          // Metadata delete still proceeds; orphaned objects can be cleaned later.
        }
      }
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("evidence")
        .delete()
        .eq("id", record.id)
        .eq("owner_id", user.id);
      if (deleteError) {
        throw deleteError;
      }
      router.push("/evidence");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete evidence");
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (!record?.storage_path) {
      return;
    }
    try {
      const url = await signedEvidenceUrl(record.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file");
    }
  }

  if (authLoading || loading || !form || !record) {
    return <PageLoading />;
  }

  const quality = evidenceQuality(
    {
      retention_date: form.retention_date,
      storage_path: record.storage_path,
    },
    { evidenceStorageReady },
  );

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header>
          <BackLink href="/evidence">← Back to evidence</BackLink>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Edit evidence
          </h1>
        </header>

        {!evidenceReady ? (
          <SchemaNotice>
            Run <code className="font-mono">009_evidence.sql</code> first.
          </SchemaNotice>
        ) : null}
        {evidenceReady && !evidenceStorageReady ? (
          <SchemaNotice>
            Uploads are disabled until Storage is configured. This record is
            metadata only.
          </SchemaNotice>
        ) : null}

        <ErrorBanner message={error} />

        <QualityCallout summary={quality} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <EvidenceFormFields
              form={form}
              entityOptions={entityOptions}
              onChange={(updates) =>
                setForm((current) =>
                  current ? { ...current, ...updates } : current,
                )
              }
            />
            {evidenceStorageReady ? (
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClassName}>Replace file (optional)</span>
                <input
                  type="file"
                  className={inputClassName}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : null}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting}
                className={primaryButtonClassName}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              {record.storage_path && evidenceStorageReady ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => void handleDownload()}
                >
                  Open file
                </button>
              ) : null}
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  if (confirmLeave()) {
                    router.push("/evidence");
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
                {deleting ? "Deleting..." : "Delete evidence"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
