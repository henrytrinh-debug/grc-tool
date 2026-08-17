"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RecordLinkList } from "@/app/components/record-link-list";
import { mutedTextClassName, secondaryButtonClassName } from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isProbeMissing } from "@/lib/supabase/owned";
import {
  formatEvidenceEntityType,
  type EvidenceEntityType,
  type EvidenceRecord,
} from "@/lib/types/evidence";
import { formatIsoDate } from "@/lib/dates";

export function EvidencePanel({
  entityType,
  entityId,
}: {
  entityType: EvidenceEntityType;
  entityId: string;
}) {
  const { evidenceReady } = useSettings();
  const [rows, setRows] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!evidenceReady || !entityId) {
      setRows([]);
      return;
    }

    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("evidence")
      .select("*")
      .eq("owner_id", session.user.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("evidence_date", { ascending: false });

    if (fetchError) {
      if (isProbeMissing(fetchError)) {
        setRows([]);
        return;
      }
      setError(fetchError.message);
      return;
    }

    setRows((data ?? []) as EvidenceRecord[]);
  }, [entityId, entityType, evidenceReady]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!evidenceReady) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Evidence
          </h2>
          <p className={`mt-1 text-sm ${mutedTextClassName}`}>
            Artefacts linked to this {formatEvidenceEntityType(entityType).toLowerCase()}.
          </p>
        </div>
        <Link
          href={`/evidence/new?entityType=${entityType}&entityId=${entityId}`}
          className={secondaryButtonClassName}
        >
          Add evidence
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : (
        <RecordLinkList
          items={rows.map((row) => ({
            id: row.id,
            href: `/evidence/${row.id}/edit`,
            title: row.title,
            detail: row.source || undefined,
            meta: formatIsoDate(row.evidence_date),
          }))}
          empty="No evidence linked yet."
          limit={6}
          moreHref={`/evidence?entityType=${entityType}`}
        />
      )}
    </section>
  );
}
